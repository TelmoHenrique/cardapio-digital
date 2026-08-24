import React, { useState, useEffect, useRef } from 'react';
import { Plus, Minus, Edit2, Trash2, X, ChefHat, ArrowLeft, Flame, Image as ImageIcon, Search, LogOut, Loader2, Bell, Check, Instagram, MessageCircle, ListPlus, ShoppingBag, ReceiptText, Phone, Menu, User, Layers, Truck, Copy, MapPin, Clock, Wallet } from 'lucide-react';

const SUPABASE_URL = 'https://xzipsbuwsjyzgsfasygc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6aXBzYnV3c2p5emdzZmFzeWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNDc0NTYsImV4cCI6MjEwMjcyMzQ1Nn0.6k5ocACvG-ihQyPhmdquEriavxK7Un6E3LSECz8J5GA';
const RESTAURANTE_SLUG = 'restaurante-raiz'; // usado só se a URL não tiver nenhum caminho (ex: menupapa.com.br sem nada depois)

// Lê o "nome" do restaurante direto da URL (ex: menupapa.com.br/espeto-do-dito → "espeto-do-dito")
function getSlugDaUrl() {
  const caminho = window.location.pathname.replace(/^\/+|\/+$/g, ''); // remove barras do início/fim
  return caminho || null;
}

// ---------- Sua marca (SaaS) — edite aqui ----------
const MARCA_NOME = 'MENU PAPA';
const MARCA_LOGO_URL = 'https://i.imgur.com/Rn2P8qP.jpeg';

// ---------- Helper: chamadas REST diretas ao Supabase ----------

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      'Prefer': options.method && options.method !== 'GET' ? 'return=representation' : undefined,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Erro ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function sbAuth(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Falha na autenticação');
  return data;
}

function formatPreco(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// O Supabase devolve timestamps sem indicar o fuso (ex: "2026-08-22T22:50:00"), e o
// navegador interpretaria isso como hora local por engano. Forçamos a leitura como UTC.
function parseDataUTC(valor) {
  if (!valor) return new Date(NaN);
  return new Date(valor.endsWith('Z') ? valor : valor + 'Z');
}

// Transforma "1,2,3,4,5" em "Segunda a Sexta", agrupando dias consecutivos
function listaHorarioSemanal(diasStr, horaAbertura, horaFechamento) {
  const diasPermitidos = (diasStr || '0,1,2,3,4,5,6').split(',').map(Number);
  const ordem = [1, 2, 3, 4, 5, 6, 0]; // Segunda...Domingo
  const nomes = { 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado', 0: 'Domingo' };
  return ordem.map(d => {
    const aberto = diasPermitidos.includes(d);
    return {
      dia: nomes[d],
      texto: aberto && horaAbertura && horaFechamento ? `${horaAbertura} às ${horaFechamento}` : 'Fechado',
      aberto,
    };
  });
}

// Aceita tanto um link completo (https://wa.me/...) quanto só o número, e sempre devolve uma URL válida
function whatsappHref(valor) {
  if (!valor) return null;
  if (/^https?:\/\//i.test(valor.trim())) return valor.trim();
  const digitos = valor.replace(/\D/g, '');
  if (!digitos) return null;
  return `https://wa.me/${digitos}`;
}

// Salva/recupera os dados do cliente no próprio navegador, para preencher automaticamente da próxima vez
function chaveClienteStorage(restauranteId) {
  return `cardapio_cliente_${restauranteId || 'geral'}`;
}

function carregarDadosCliente(restauranteId) {
  try {
    const raw = localStorage.getItem(chaveClienteStorage(restauranteId));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function salvarDadosCliente(restauranteId, dados) {
  try {
    localStorage.setItem(chaveClienteStorage(restauranteId), JSON.stringify(dados));
  } catch (e) { /* navegador pode bloquear localStorage (modo privado); segue sem salvar */ }
}

// Calcula se o restaurante está aberto agora, considerando status manual, dias da semana e horário
function calcularStatusAbertura(restaurante) {
  if (!restaurante) return null;

  // 1. Status manual tem prioridade sobre tudo
  if (restaurante.status_manual === 'aberto') {
    return { aberto: true, texto: 'Aberto agora' };
  }
  if (restaurante.status_manual === 'fechado') {
    return { aberto: false, texto: 'Fechado no momento' };
  }

  // 2. Modo automático: verifica dia da semana
  const diasStr = restaurante.dias_funcionamento || '0,1,2,3,4,5,6';
  const diasPermitidos = diasStr.split(',').map(Number);
  const hoje = new Date().getDay(); // 0=domingo ... 6=sábado
  if (!diasPermitidos.includes(hoje)) {
    return { aberto: false, texto: 'Fechado hoje' };
  }

  // 3. Verifica horário do dia
  const { hora_abertura: horaAbertura, hora_fechamento: horaFechamento } = restaurante;
  if (!horaAbertura || !horaFechamento) return null;

  const agora = new Date();
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
  const [hA, mA] = horaAbertura.split(':').map(Number);
  const [hF, mF] = horaFechamento.split(':').map(Number);
  const minutosAbertura = hA * 60 + mA;
  const minutosFechamento = hF * 60 + mF;

  let aberto;
  if (minutosFechamento > minutosAbertura) {
    aberto = minutosAgora >= minutosAbertura && minutosAgora < minutosFechamento;
  } else {
    aberto = minutosAgora >= minutosAbertura || minutosAgora < minutosFechamento;
  }

  return {
    aberto,
    texto: aberto
      ? `Aberto até às ${horaFechamento}`
      : `Fechado — abre às ${horaAbertura}`,
  };
}

// Redimensiona e comprime a imagem no navegador antes de enviar (evita fotos pesadas)
function comprimirImagem(file, maxDim = 1000, qualidade = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Falha ao comprimir imagem')),
        'image/webp',
        qualidade
      );
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadFoto(file, token) {
  const comprimida = await comprimirImagem(file);
  const nomeArquivo = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/fotos-pratos/${nomeArquivo}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'image/webp',
    },
    body: comprimida,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Falha no upload: ' + err);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/fotos-pratos/${nomeArquivo}`;
}

// ---------- LOGIN ----------

function LoginScreen({ onLogin, onBack }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const handleLogin = async () => {
    setErro('');
    setLoading(true);
    try {
      const data = await sbAuth('token?grant_type=password', { email, password: senha });
      onLogin(data.access_token, data.user.id);
    } catch (e) {
      setErro('Email ou senha incorretos.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <button onClick={onBack} className="flex items-center gap-1.5 text-stone-400 text-sm mb-6"><ArrowLeft size={15} /> Voltar ao cardápio</button>
        <div className="bg-white border border-stone-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-1">
            <ChefHat size={18} className="text-stone-900" />
            <h2 className="text-lg font-semibold text-stone-900">Painel do restaurante</h2>
          </div>
          <p className="text-sm text-stone-500 mb-5">Entre com seu email e senha de administrador.</p>

          <div className="space-y-3">
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
              className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-stone-900" />
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Senha"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-stone-900" />
          </div>

          {erro && <p className="text-sm text-red-600 mt-3">{erro}</p>}

          <button onClick={handleLogin} disabled={loading || !email || !senha}
            className="w-full mt-5 bg-stone-900 disabled:bg-stone-300 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2">
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- FORM DE ITEM ----------

function ItemForm({ item, categorias, token, onSave, onCancel }) {
  const [form, setForm] = useState(item || { categoria_id: categorias[0]?.id || '', nome: '', preco: '', descricao: '', disponivel: true, destaque: false, foto_url: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [erroFoto, setErroFoto] = useState('');

  const handleSave = async () => {
    setSaving(true);
    await onSave({ ...form, preco: parseFloat(form.preco) || 0 });
    setSaving(false);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErroFoto('');
    setUploading(true);
    try {
      const url = await uploadFoto(file, token);
      setForm(f => ({ ...f, foto_url: url }));
    } catch (err) {
      setErroFoto('Não foi possível enviar a foto. Tente novamente.');
    }
    setUploading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-stone-900">{item ? 'Editar prato' : 'Novo prato'}</h3>
          <button onClick={onCancel} className="text-stone-400 hover:text-stone-600"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-stone-600 mb-1 block">Foto do prato</label>
            <div className="flex gap-3 items-start">
              <div className="w-20 h-20 rounded-lg bg-stone-100 overflow-hidden shrink-0 flex items-center justify-center border border-stone-200 relative">
                {uploading
                  ? <Loader2 size={18} className="text-stone-400 animate-spin" />
                  : form.foto_url
                    ? <img src={form.foto_url} alt="" className="w-full h-full object-cover" />
                    : <ImageIcon size={20} className="text-stone-300" />}
              </div>
              <div className="flex-1">
                <label className="inline-flex items-center gap-1.5 bg-stone-900 text-white text-sm px-3 py-2 rounded-lg font-medium cursor-pointer">
                  <Plus size={14} /> {form.foto_url ? 'Trocar foto' : 'Escolher foto'}
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" disabled={uploading} />
                </label>
                <p className="text-xs text-stone-400 mt-1.5">Do computador, celular ou galeria.</p>
                {erroFoto && <p className="text-xs text-red-600 mt-1">{erroFoto}</p>}
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm text-stone-600 mb-1 block">Grupo / categoria</label>
            <select value={form.categoria_id} onChange={e => setForm({...form, categoria_id: e.target.value})}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-900">
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-stone-600 mb-1 block">Nome do prato</label>
            <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-900" placeholder="Ex: Picanha na Brasa" />
          </div>
          <div>
            <label className="text-sm text-stone-600 mb-1 block">Descrição</label>
            <textarea value={form.descricao || ''} onChange={e => setForm({...form, descricao: e.target.value})}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-900 h-20 resize-none" />
          </div>
          <div>
            <label className="text-sm text-stone-600 mb-1 block">Preço (R$)</label>
            <input type="number" value={form.preco} onChange={e => setForm({...form, preco: e.target.value})}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-900" />
          </div>
          <div>
            <label className="text-sm text-stone-600 mb-1 block">Posição no grupo</label>
            <input type="number" value={form.ordem ?? 0} onChange={e => setForm({...form, ordem: parseInt(e.target.value) || 0})}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-900" placeholder="0" />
            <p className="text-xs text-stone-400 mt-1">Menor número aparece primeiro dentro do grupo.</p>
          </div>
          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={form.disponivel} onChange={e => setForm({...form, disponivel: e.target.checked})} className="w-4 h-4" />
              Disponível
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={form.destaque} onChange={e => setForm({...form, destaque: e.target.checked})} className="w-4 h-4" />
              Destaque
            </label>
          </div>
          {form.destaque && (
            <div>
              <label className="text-sm text-stone-600 mb-1 block">Posição no carrossel de destaques</label>
              <input type="number" value={form.ordem_destaque ?? 0} onChange={e => setForm({...form, ordem_destaque: parseInt(e.target.value) || 0})}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-900" placeholder="0" />
              <p className="text-xs text-stone-400 mt-1">Independente da posição no grupo. Menor número aparece primeiro no carrossel.</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg border border-stone-300 text-stone-700 font-medium">Cancelar</button>
          <button onClick={handleSave} disabled={saving || uploading}
            className="flex-1 py-2.5 rounded-lg bg-stone-900 text-white font-medium flex items-center justify-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- ADMIN ----------

function GroupManager({ token, categorias, restauranteId, onClose, onChanged }) {
  const [novo, setNovo] = useState('');
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [ordens, setOrdens] = useState({});
  const [descricoes, setDescricoes] = useState({});
  const [expandido, setExpandido] = useState(null);
  const authHeaders = { Authorization: `Bearer ${token}` };
  const ordenadas = [...categorias].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  const addGroup = async () => {
    if (!novo.trim()) return;
    setSaving(true);
    setErro('');
    try {
      const proximaOrdem = categorias.length > 0 ? Math.max(...categorias.map(c => c.ordem || 0)) + 1 : 1;
      await sbFetch('categorias', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ restaurante_id: restauranteId, nome: novo.trim(), ordem: proximaOrdem }),
      });
      setNovo('');
      onChanged();
    } catch (e) {
      setErro('Erro ao criar grupo: ' + e.message);
    }
    setSaving(false);
  };

  const removeGroup = async (cat) => {
    if (!confirm(`Excluir o grupo "${cat.nome}"? Isso só funciona se não houver pratos nele.`)) return;
    try {
      await sbFetch(`categorias?id=eq.${cat.id}`, { method: 'DELETE', headers: authHeaders });
      onChanged();
    } catch (e) {
      setErro('Não foi possível excluir. Mova ou apague os pratos deste grupo primeiro.');
    }
  };

  const salvarOrdem = async (cat) => {
    const novaOrdem = ordens[cat.id] ?? cat.ordem ?? 0;
    try {
      await sbFetch(`categorias?id=eq.${cat.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ ordem: novaOrdem }) });
      onChanged();
    } catch (e) {
      setErro('Erro ao reordenar: ' + e.message);
    }
  };

  const salvarDescricao = async (cat) => {
    const novaDescricao = descricoes[cat.id] ?? cat.descricao ?? '';
    try {
      await sbFetch(`categorias?id=eq.${cat.id}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ descricao: novaDescricao || null }) });
      onChanged();
    } catch (e) {
      setErro('Erro ao salvar descrição: ' + e.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-stone-900">Grupos do cardápio</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X size={20} /></button>
        </div>
        <p className="text-xs text-stone-400 mb-2">Defina o número de ordem de cada grupo. Menor número aparece primeiro.</p>
        <div className="space-y-2 mb-4 max-h-80 overflow-y-auto">
          {ordenadas.map((cat) => (
            <div key={cat.id} className="bg-stone-50 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-stone-800 flex-1 truncate">{cat.nome}</span>
                <input
                  type="number"
                  defaultValue={cat.ordem ?? 0}
                  onChange={e => setOrdens(o => ({ ...o, [cat.id]: parseInt(e.target.value) || 0 }))}
                  onBlur={() => salvarOrdem(cat)}
                  className="w-14 border border-stone-300 rounded-md px-2 py-1 text-sm text-stone-900 text-center"
                />
                <button onClick={() => setExpandido(expandido === cat.id ? null : cat.id)}
                  className={`shrink-0 ${expandido === cat.id ? 'text-orange-600' : 'text-stone-400 hover:text-stone-700'}`} title="Descrição do grupo">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => removeGroup(cat)} className="text-stone-400 hover:text-red-600 shrink-0"><Trash2 size={14} /></button>
              </div>
              {expandido === cat.id && (
                <div className="mt-2">
                  <textarea
                    defaultValue={cat.descricao || ''}
                    onChange={e => setDescricoes(d => ({ ...d, [cat.id]: e.target.value }))}
                    onBlur={() => salvarDescricao(cat)}
                    placeholder="Descrição opcional do grupo (ex: Pratos que acompanham arroz, farofa e vinagrete)"
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900 h-16 resize-none"
                  />
                </div>
              )}
            </div>
          ))}
          {categorias.length === 0 && <p className="text-sm text-stone-400">Nenhum grupo ainda.</p>}
        </div>
        {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}
        <div className="flex gap-2">
          <input value={novo} onChange={e => setNovo(e.target.value)} onKeyDown={e => e.key === 'Enter' && addGroup()}
            placeholder="Nome do novo grupo" className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900" />
          <button onClick={addGroup} disabled={saving} className="bg-stone-900 text-white px-4 rounded-lg text-sm font-medium">
            {saving ? <Loader2 size={14} className="animate-spin" /> : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileEditor({ token, restauranteId, dadosAtuais, onClose, onChanged }) {
  const [form, setForm] = useState({
    nome: dadosAtuais?.nome || '',
    endereco: dadosAtuais?.endereco || '',
    horario_texto: dadosAtuais?.horario_texto || '',
    hora_abertura: dadosAtuais?.hora_abertura || '',
    hora_fechamento: dadosAtuais?.hora_fechamento || '',
    logo_url: dadosAtuais?.logo_url || '',
    capa_url: dadosAtuais?.capa_url || '',
    instagram_url: dadosAtuais?.instagram_url || '',
    whatsapp_url: dadosAtuais?.whatsapp_url || '',
    pedido_habilitado: dadosAtuais?.pedido_habilitado ?? false,
    whatsapp_pedido_numero: dadosAtuais?.whatsapp_pedido_numero || '',
    status_manual: dadosAtuais?.status_manual || 'auto',
    dias_funcionamento: dadosAtuais?.dias_funcionamento || '0,1,2,3,4,5,6',
    formas_pagamento: dadosAtuais?.formas_pagamento || '',
    endereco_completo: dadosAtuais?.endereco_completo || '',
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCapa, setUploadingCapa] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const authHeaders = { Authorization: `Bearer ${token}` };

  const handleUpload = async (file, campo, setUploading) => {
    setUploading(true);
    setErro('');
    try {
      const url = await uploadFoto(file, token);
      setForm(f => ({ ...f, [campo]: url }));
    } catch (e) {
      setErro('Erro ao enviar imagem: ' + e.message);
    }
    setUploading(false);
  };

  const salvar = async () => {
    setSaving(true);
    setErro('');
    try {
      await sbFetch(`restaurantes?id=eq.${restauranteId}`, {
        method: 'PATCH', headers: authHeaders,
        body: JSON.stringify(form),
      });
      onChanged();
      onClose();
    } catch (e) {
      setErro('Erro ao salvar: ' + e.message);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-stone-900">Perfil do restaurante</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-stone-600 mb-1 block">Foto de capa</label>
            <div className="w-full h-24 rounded-lg bg-stone-100 overflow-hidden mb-2 flex items-center justify-center">
              {uploadingCapa ? <Loader2 size={18} className="animate-spin text-stone-400" /> :
                form.capa_url ? <img src={form.capa_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-stone-300" />}
            </div>
            <label className="inline-flex items-center gap-1.5 bg-stone-900 text-white text-xs px-3 py-1.5 rounded-lg font-medium cursor-pointer">
              <Plus size={12} /> {form.capa_url ? 'Trocar capa' : 'Escolher capa'}
              <input type="file" accept="image/*" className="hidden" disabled={uploadingCapa}
                onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'capa_url', setUploadingCapa)} />
            </label>
          </div>

          <div>
            <label className="text-sm text-stone-600 mb-1 block">Logo (foto de perfil)</label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-stone-100 overflow-hidden flex items-center justify-center shrink-0">
                {uploadingLogo ? <Loader2 size={16} className="animate-spin text-stone-400" /> :
                  form.logo_url ? <img src={form.logo_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={16} className="text-stone-300" />}
              </div>
              <label className="inline-flex items-center gap-1.5 bg-stone-900 text-white text-xs px-3 py-1.5 rounded-lg font-medium cursor-pointer">
                <Plus size={12} /> {form.logo_url ? 'Trocar logo' : 'Escolher logo'}
                <input type="file" accept="image/*" className="hidden" disabled={uploadingLogo}
                  onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'logo_url', setUploadingLogo)} />
              </label>
            </div>
          </div>

          <div>
            <label className="text-sm text-stone-600 mb-1 block">Nome do restaurante</label>
            <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-900" />
          </div>
          <div>
            <label className="text-sm text-stone-600 mb-1 block">Endereço / cidade</label>
            <input value={form.endereco} onChange={e => setForm({...form, endereco: e.target.value})}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-900" placeholder="Ex: São Paulo - SP" />
          </div>
          <div>
            <label className="text-sm text-stone-600 mb-1 block">Horário de funcionamento</label>
            <div className="flex items-center gap-2">
              <input type="time" value={form.hora_abertura} onChange={e => setForm({...form, hora_abertura: e.target.value})}
                className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-stone-900" />
              <span className="text-stone-400 text-sm">até</span>
              <input type="time" value={form.hora_fechamento} onChange={e => setForm({...form, hora_fechamento: e.target.value})}
                className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-stone-900" />
            </div>
            <p className="text-xs text-stone-400 mt-1">O cardápio mostra "Aberto"/"Fechado" automaticamente com base nesse horário.</p>
          </div>

          <div>
            <label className="text-sm text-stone-600 mb-1.5 block">Dias que a loja funciona</label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { valor: 1, label: 'Seg' }, { valor: 2, label: 'Ter' }, { valor: 3, label: 'Qua' },
                { valor: 4, label: 'Qui' }, { valor: 5, label: 'Sex' }, { valor: 6, label: 'Sáb' }, { valor: 0, label: 'Dom' },
              ].map(dia => {
                const diasAtivos = form.dias_funcionamento.split(',').map(Number);
                const ativo = diasAtivos.includes(dia.valor);
                return (
                  <button key={dia.valor} type="button"
                    onClick={() => {
                      const novosDias = ativo ? diasAtivos.filter(d => d !== dia.valor) : [...diasAtivos, dia.valor];
                      setForm({ ...form, dias_funcionamento: novosDias.sort().join(',') });
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${ativo ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-400'}`}>
                    {dia.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-stone-400 mt-1.5">Dias desmarcados aparecem como "Fechado hoje" no cardápio.</p>
          </div>

          <div>
            <label className="text-sm text-stone-600 mb-1 block">Status da loja agora</label>
            <select value={form.status_manual} onChange={e => setForm({...form, status_manual: e.target.value})}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-900">
              <option value="auto">Automático (segue horário e dias configurados)</option>
              <option value="aberto">Forçar aberto agora</option>
              <option value="fechado">Forçar fechado agora</option>
            </select>
            <p className="text-xs text-stone-400 mt-1">Use "Forçar" para abrir ou fechar a loja manualmente a qualquer momento, ignorando o horário.</p>
          </div>

          <div>
            <label className="text-sm text-stone-600 mb-1 block">Endereço completo (para mostrar no mapa)</label>
            <textarea value={form.endereco_completo} onChange={e => setForm({...form, endereco_completo: e.target.value})}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-900 h-16 resize-none"
              placeholder="Ex: Rua Desembargador Costa Ribeiro, 47, Dom Aquino, Cuiabá - MT" />
            <p className="text-xs text-stone-400 mt-1">O cliente vai poder abrir esse endereço direto no Google Maps.</p>
          </div>

          <div>
            <label className="text-sm text-stone-600 mb-1.5 block">Formas de pagamento aceitas</label>
            <div className="flex flex-wrap gap-1.5">
              {['Pix', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Vale-refeição'].map(forma => {
                const ativas = form.formas_pagamento ? form.formas_pagamento.split(',') : [];
                const ativa = ativas.includes(forma);
                return (
                  <button key={forma} type="button"
                    onClick={() => {
                      const novas = ativa ? ativas.filter(f => f !== forma) : [...ativas, forma];
                      setForm({ ...form, formas_pagamento: novas.join(',') });
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${ativa ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-400'}`}>
                    {forma}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm text-stone-600 mb-1 block flex items-center gap-1.5"><Instagram size={13} /> Instagram</label>
            <input value={form.instagram_url} onChange={e => setForm({...form, instagram_url: e.target.value})}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-900" placeholder="https://instagram.com/seurestaurante" />
          </div>
          <div>
            <label className="text-sm text-stone-600 mb-1 block flex items-center gap-1.5"><MessageCircle size={13} /> WhatsApp</label>
            <input value={form.whatsapp_url} onChange={e => setForm({...form, whatsapp_url: e.target.value})}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-900" placeholder="https://wa.me/5511999999999" />
            <p className="text-xs text-stone-400 mt-1">Pode colar só o número (com DDD e código do país) ou o link completo.</p>
          </div>

          <div className="pt-2 border-t border-stone-100">
            <label className="flex items-center gap-2 text-sm font-medium text-stone-800 mt-4">
              <input type="checkbox" checked={form.pedido_habilitado} onChange={e => setForm({...form, pedido_habilitado: e.target.checked})} className="w-4 h-4" />
              Ativar pedidos pelo cardápio (Pacote com Pedido)
            </label>
            {form.pedido_habilitado && (
              <div className="mt-3">
                <label className="text-sm text-stone-600 mb-1 block">Número de WhatsApp para receber pedidos</label>
                <input value={form.whatsapp_pedido_numero} onChange={e => setForm({...form, whatsapp_pedido_numero: e.target.value})}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-900" placeholder="5565999999999" />
                <p className="text-xs text-stone-400 mt-1">Só números, com código do país (55) e DDD.</p>
              </div>
            )}
          </div>
        </div>

        {erro && <p className="text-sm text-red-600 mt-3">{erro}</p>}

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-stone-300 text-stone-700 font-medium">Cancelar</button>
          <button onClick={salvar} disabled={saving || uploadingLogo || uploadingCapa}
            className="flex-1 py-2.5 rounded-lg bg-stone-900 text-white font-medium flex items-center justify-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionsManager({ token, prato, onClose }) {
  const [opcoes, setOpcoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [novo, setNovo] = useState({ nome: '', descricao: '', preco_adicional: '', ordem: '' });
  const [editandoId, setEditandoId] = useState(null);
  const [saving, setSaving] = useState(false);
  const authHeaders = { Authorization: `Bearer ${token}` };

  const carregar = async () => {
    setLoading(true);
    try {
      const dados = await sbFetch(`opcoes_produto?prato_id=eq.${prato.id}&order=ordem`, { headers: authHeaders });
      setOpcoes(dados || []);
    } catch (e) {
      setErro('Erro ao carregar opções: ' + e.message);
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const iniciarEdicao = (opcao) => {
    setEditandoId(opcao.id);
    setNovo({
      nome: opcao.nome,
      descricao: opcao.descricao || '',
      preco_adicional: opcao.preco_adicional ? String(opcao.preco_adicional) : '',
      ordem: opcao.ordem != null ? String(opcao.ordem) : '',
    });
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setNovo({ nome: '', descricao: '', preco_adicional: '', ordem: '' });
  };

  const salvarOpcao = async () => {
    if (!novo.nome.trim()) return;
    setSaving(true);
    setErro('');
    try {
      if (editandoId) {
        await sbFetch(`opcoes_produto?id=eq.${editandoId}`, {
          method: 'PATCH', headers: authHeaders,
          body: JSON.stringify({
            nome: novo.nome.trim(),
            descricao: novo.descricao.trim() || null,
            preco_adicional: parseFloat(novo.preco_adicional) || 0,
            ordem: novo.ordem !== '' ? parseInt(novo.ordem) : 0,
          }),
        });
      } else {
        const proximaOrdem = novo.ordem !== '' ? parseInt(novo.ordem) : (opcoes.length > 0 ? Math.max(...opcoes.map(o => o.ordem || 0)) + 1 : 1);
        await sbFetch('opcoes_produto', {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({
            prato_id: prato.id,
            nome: novo.nome.trim(),
            descricao: novo.descricao.trim() || null,
            preco_adicional: parseFloat(novo.preco_adicional) || 0,
            disponivel: true,
            ordem: proximaOrdem,
          }),
        });
      }
      setNovo({ nome: '', descricao: '', preco_adicional: '', ordem: '' });
      setEditandoId(null);
      carregar();
    } catch (e) {
      setErro('Erro ao salvar: ' + e.message);
    }
    setSaving(false);
  };

  const toggleDisponivel = async (opcao) => {
    try {
      await sbFetch(`opcoes_produto?id=eq.${opcao.id}`, {
        method: 'PATCH', headers: authHeaders,
        body: JSON.stringify({ disponivel: !opcao.disponivel }),
      });
      carregar();
    } catch (e) { setErro('Erro ao atualizar: ' + e.message); }
  };

  const removerOpcao = async (opcao) => {
    try {
      await sbFetch(`opcoes_produto?id=eq.${opcao.id}`, { method: 'DELETE', headers: authHeaders });
      if (editandoId === opcao.id) cancelarEdicao();
      carregar();
    } catch (e) { setErro('Erro ao excluir: ' + e.message); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold text-stone-900">Opções — {prato.nome}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X size={20} /></button>
        </div>
        <p className="text-xs text-stone-400 mb-4">Ex: sabores, tamanhos, adicionais. Só as marcadas como "Disponível" aparecem no cardápio.</p>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-stone-400" /></div>
        ) : (
          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
            {opcoes.map(op => (
              <div key={op.id} className={`flex items-center justify-between rounded-lg px-3 py-2 gap-2 ${editandoId === op.id ? 'bg-orange-50 border border-orange-200' : op.disponivel ? 'bg-stone-50' : 'bg-stone-100 opacity-60'}`}>
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-stone-200 text-stone-600 text-[10px] font-semibold shrink-0">
                  {op.ordem ?? 0}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-800 truncate">{op.nome}</p>
                  {op.descricao && <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{op.descricao}</p>}
                  {op.preco_adicional > 0 && (
                    <p className="text-xs text-emerald-600 mt-0.5">+ {formatPreco(op.preco_adicional)}</p>
                  )}
                </div>
                <button onClick={() => toggleDisponivel(op)}
                  className={`text-xs px-2 py-1 rounded-md font-medium whitespace-nowrap ${op.disponivel ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-200 text-stone-500'}`}>
                  {op.disponivel ? 'Disponível' : 'Em falta'}
                </button>
                <button onClick={() => iniciarEdicao(op)} className="text-stone-400 hover:text-stone-700 shrink-0 w-8 h-8 flex items-center justify-center"><Edit2 size={15} /></button>
                <button onClick={() => removerOpcao(op)} className="text-stone-400 hover:text-red-600 shrink-0 w-8 h-8 flex items-center justify-center"><Trash2 size={15} /></button>
              </div>
            ))}
            {opcoes.length === 0 && <p className="text-sm text-stone-400">Nenhuma opção cadastrada ainda.</p>}
          </div>
        )}

        {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}

        <div className="border-t border-stone-200 pt-4 space-y-2">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
            {editandoId ? 'Editando opção' : 'Nova opção'}
          </p>
          <div className="flex gap-2">
            <input value={novo.nome} onChange={e => setNovo({...novo, nome: e.target.value})}
              placeholder="Ex: Completo" className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900" />
            <input type="number" value={novo.preco_adicional} onChange={e => setNovo({...novo, preco_adicional: e.target.value})}
              placeholder="+R$" className="w-20 border border-stone-300 rounded-lg px-2 py-2 text-sm text-stone-900" />
          </div>
          <textarea value={novo.descricao} onChange={e => setNovo({...novo, descricao: e.target.value})}
            placeholder="O que compõe essa opção (opcional). Ex: Acompanha arroz, farofa, mandioca e vinagrete"
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900 h-16 resize-none" />
          <div>
            <label className="text-xs text-stone-500 mb-1 block">Posição na lista (menor número aparece primeiro)</label>
            <input type="number" value={novo.ordem} onChange={e => setNovo({...novo, ordem: e.target.value})}
              placeholder="Ex: 1" className="w-24 border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900" />
          </div>
          <div className="flex gap-2">
            {editandoId && (
              <button onClick={cancelarEdicao} className="flex-1 py-2 rounded-lg border border-stone-300 text-stone-600 text-sm font-medium">
                Cancelar
              </button>
            )}
            <button onClick={salvarOpcao} disabled={saving} className="flex-1 bg-stone-900 text-white text-sm py-2 rounded-lg font-medium flex items-center justify-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : editandoId ? 'Salvar alteração' : 'Adicionar opção'}
            </button>
          </div>
        </div>

        <button onClick={onClose} className="w-full mt-4 py-2.5 rounded-lg border border-stone-300 text-stone-700 font-medium">Fechar</button>
      </div>
    </div>
  );
}

function DeliveryFeesManager({ token, restauranteId, onClose }) {
  const [taxas, setTaxas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState({ bairro: '', valor: '' });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [modoLote, setModoLote] = useState(false);
  const [textoLote, setTextoLote] = useState('');
  const [salvandoLote, setSalvandoLote] = useState(false);
  const authHeaders = { Authorization: `Bearer ${token}` };

  const carregar = async () => {
    setLoading(true);
    try {
      const dados = await sbFetch(`taxas_entrega?restaurante_id=eq.${restauranteId}&order=bairro`, { headers: authHeaders });
      setTaxas(dados || []);
    } catch (e) {
      setErro('Erro ao carregar taxas: ' + e.message);
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const addTaxa = async () => {
    if (!novo.bairro.trim()) return;
    setSaving(true);
    setErro('');
    try {
      await sbFetch('taxas_entrega', {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ restaurante_id: restauranteId, bairro: novo.bairro.trim(), valor: parseFloat(novo.valor) || 0 }),
      });
      setNovo({ bairro: '', valor: '' });
      carregar();
    } catch (e) {
      setErro('Erro ao adicionar: ' + e.message);
    }
    setSaving(false);
  };

  const removerTaxa = async (id) => {
    try {
      await sbFetch(`taxas_entrega?id=eq.${id}`, { method: 'DELETE', headers: authHeaders });
      carregar();
    } catch (e) { setErro('Erro ao excluir: ' + e.message); }
  };

  const salvarLote = async () => {
    const linhas = textoLote.split('\n').map(l => l.trim()).filter(Boolean);
    if (linhas.length === 0) return;

    const registros = linhas.map(linha => {
      // Aceita separador por vírgula, hífen ou ponto-e-vírgula: "Centro - 5" ou "Centro, 5"
      const partes = linha.split(/[-,;]/);
      const valor = parseFloat(partes[partes.length - 1].replace(',', '.').trim()) || 0;
      const bairro = partes.slice(0, -1).join('-').trim() || linha.trim();
      return { restaurante_id: restauranteId, bairro, valor };
    }).filter(r => r.bairro);

    if (registros.length === 0) return;

    setSalvandoLote(true);
    setErro('');
    try {
      await sbFetch('taxas_entrega', {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify(registros),
      });
      setTextoLote('');
      setModoLote(false);
      carregar();
    } catch (e) {
      setErro('Erro ao adicionar em lote: ' + e.message);
    }
    setSalvandoLote(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold text-stone-900">Taxas de entrega por bairro</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X size={20} /></button>
        </div>
        <p className="text-xs text-stone-400 mb-4">Quando o cliente digita o CEP, o sistema identifica o bairro e já aplica o valor cadastrado aqui.</p>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-stone-400" /></div>
        ) : (
          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
            {taxas.map(t => (
              <div key={t.id} className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2 gap-2">
                <span className="text-sm text-stone-800 flex-1 truncate">{t.bairro}</span>
                <span className="text-sm font-semibold text-emerald-700">{formatPreco(t.valor)}</span>
                <button onClick={() => removerTaxa(t.id)} className="text-stone-400 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            ))}
            {taxas.length === 0 && <p className="text-sm text-stone-400">Nenhum bairro cadastrado ainda.</p>}
          </div>
        )}

        {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}

        <div className="border-t border-stone-200 pt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
              {modoLote ? 'Adicionar vários de uma vez' : 'Novo bairro'}
            </p>
            <button onClick={() => setModoLote(m => !m)} className="text-xs text-stone-500 underline">
              {modoLote ? 'Voltar ao modo simples' : 'Colar lista'}
            </button>
          </div>

          {modoLote ? (
            <div className="space-y-2">
              <textarea
                value={textoLote}
                onChange={e => setTextoLote(e.target.value)}
                placeholder={'Centro - 5\nJardim das Flores - 8\nBoa Esperança, 6\nVila Nova; 7'}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900 h-28 resize-none font-mono"
              />
              <p className="text-xs text-stone-400">Um bairro por linha, separando o valor com hífen ou vírgula. Ex: "Centro - 5".</p>
              <button onClick={salvarLote} disabled={salvandoLote || !textoLote.trim()}
                className="w-full bg-stone-900 text-white text-sm py-2 rounded-lg font-medium flex items-center justify-center gap-2">
                {salvandoLote ? <Loader2 size={14} className="animate-spin" /> : 'Adicionar todos'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input value={novo.bairro} onChange={e => setNovo({...novo, bairro: e.target.value})}
                  placeholder="Ex: Centro" className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900" />
                <input type="number" value={novo.valor} onChange={e => setNovo({...novo, valor: e.target.value})}
                  placeholder="R$" className="w-20 border border-stone-300 rounded-lg px-2 py-2 text-sm text-stone-900" />
              </div>
              <button onClick={addTaxa} disabled={saving} className="w-full bg-stone-900 text-white text-sm py-2 rounded-lg font-medium flex items-center justify-center gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : 'Adicionar bairro'}
              </button>
            </div>
          )}
        </div>

        <button onClick={onClose} className="w-full mt-4 py-2.5 rounded-lg border border-stone-300 text-stone-700 font-medium">Fechar</button>
      </div>
    </div>
  );
}

function AdminView({ token, onLogout, slugOverride, onVoltarSuperAdmin }) {
  const [pratos, setPratos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [restauranteId, setRestauranteId] = useState(null);
  const [restauranteDados, setRestauranteDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [managingOptions, setManagingOptions] = useState(null);
  const [showDeliveryFees, setShowDeliveryFees] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState('cardapio'); // cardapio | relatorio
  const [pedidosRelatorio, setPedidosRelatorio] = useState([]);
  const [loadingRelatorio, setLoadingRelatorio] = useState(false);
  const hojeStr = new Date().toISOString().slice(0, 10);
  const seteDiasAtrasStr = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [dataInicio, setDataInicio] = useState(seteDiasAtrasStr);
  const [dataFim, setDataFim] = useState(hojeStr);
  const [licenca, setLicenca] = useState(null);
  const slugAtual = slugOverride || RESTAURANTE_SLUG;

  const authHeaders = { Authorization: `Bearer ${token}` };

  const carregar = async () => {
    setLoading(true);
    try {
      const rest = await sbFetch(`restaurantes?slug=eq.${slugAtual}&select=id,nome,logo_url,capa_url,endereco,horario_texto,instagram_url,whatsapp_url,hora_abertura,hora_fechamento,pedido_habilitado,whatsapp_pedido_numero,status_manual,dias_funcionamento,formas_pagamento,endereco_completo`);
      const rId = rest[0]?.id;
      setRestauranteId(rId);
      setRestauranteDados(rest[0]);

      try {
        const lics = await sbFetch(`licencas?restaurante_id=eq.${rId}&select=status,expira_em`);
        if (lics && lics.length > 0) setLicenca(lics[0]);
      } catch (e) { /* sem licença cadastrada ainda */ }

      const [cats, prts] = await Promise.all([
        sbFetch(`categorias?restaurante_id=eq.${rId}&order=ordem`),
        sbFetch(`pratos?restaurante_id=eq.${rId}&select=*`),
      ]);
      setCategorias(cats);
      setPratos(prts);
    } catch (e) {
      setErro('Erro ao carregar dados: ' + e.message);
    }
    setLoading(false);
  };

  const carregarRelatorio = async () => {
    if (!restauranteId) return;
    setLoadingRelatorio(true);
    try {
      const inicioISO = new Date(dataInicio + 'T00:00:00').toISOString();
      const fimISO = new Date(dataFim + 'T23:59:59').toISOString();
      const dados = await sbFetch(
        `pedidos?restaurante_id=eq.${restauranteId}&criado_em=gte.${inicioISO}&criado_em=lte.${fimISO}&order=criado_em.desc`,
        { headers: authHeaders }
      );
      setPedidosRelatorio(dados || []);
    } catch (e) {
      setErro('Erro ao carregar relatório: ' + e.message);
    }
    setLoadingRelatorio(false);
  };

  const alternarCancelamento = async (pedido) => {
    try {
      await sbFetch(`pedidos?id=eq.${pedido.id}`, {
        method: 'PATCH', headers: authHeaders,
        body: JSON.stringify({ cancelado: !pedido.cancelado }),
      });
      carregarRelatorio();
    } catch (e) {
      setErro('Erro ao atualizar pedido: ' + e.message);
    }
  };

  useEffect(() => {
    if (aba === 'relatorio' && restauranteId) carregarRelatorio();
  }, [aba, restauranteId, dataInicio, dataFim]);

  useEffect(() => { carregar(); }, []);

  const save = async (item) => {
    try {
      const rest = await sbFetch(`restaurantes?slug=eq.${slugAtual}&select=id`);
      const restaurante_id = rest[0]?.id;
      if (item.id) {
        await sbFetch(`pratos?id=eq.${item.id}`, {
          method: 'PATCH', headers: authHeaders,
          body: JSON.stringify({ ...item, restaurante_id }),
        });
      } else {
        await sbFetch(`pratos`, {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({ ...item, restaurante_id }),
        });
      }
      setShowForm(false);
      setEditing(null);
      carregar();
    } catch (e) {
      setErro('Erro ao salvar: ' + e.message);
    }
  };

  const remove = async (id) => {
    try {
      await sbFetch(`pratos?id=eq.${id}`, { method: 'DELETE', headers: authHeaders });
      carregar();
    } catch (e) { setErro('Erro ao excluir: ' + e.message); }
  };

  const duplicarPrato = async (item) => {
    setErro('');
    try {
      const [novoPrato] = await sbFetch('pratos', {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({
          restaurante_id: restauranteId,
          categoria_id: item.categoria_id,
          nome: `${item.nome} (cópia)`,
          descricao: item.descricao,
          preco: item.preco,
          foto_url: null,
          disponivel: item.disponivel,
          destaque: false,
          ordem: item.ordem,
        }),
      });

      // Copia também as opções/sabores do prato original, se houver
      if (novoPrato) {
        const opcoesOriginais = await sbFetch(`opcoes_produto?prato_id=eq.${item.id}`, { headers: authHeaders });
        if (opcoesOriginais && opcoesOriginais.length > 0) {
          const novasOpcoes = opcoesOriginais.map(op => ({
            prato_id: novoPrato.id,
            nome: op.nome,
            descricao: op.descricao,
            preco_adicional: op.preco_adicional,
            disponivel: op.disponivel,
            ordem: op.ordem,
          }));
          await sbFetch('opcoes_produto', { method: 'POST', headers: authHeaders, body: JSON.stringify(novasOpcoes) });
        }
      }
      carregar();
    } catch (e) {
      setErro('Erro ao duplicar: ' + e.message);
    }
  };

  const toggleDisponivel = async (item) => {
    try {
      await sbFetch(`pratos?id=eq.${item.id}`, {
        method: 'PATCH', headers: authHeaders,
        body: JSON.stringify({ disponivel: !item.disponivel }),
      });
      carregar();
    } catch (e) { setErro('Erro ao atualizar: ' + e.message); }
  };


  if (loading) {
    return <div className="min-h-screen bg-stone-50 flex items-center justify-center"><Loader2 className="animate-spin text-stone-400" size={28} /></div>;
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-stone-900 text-white px-4 py-3.5 flex items-center justify-between sticky top-0 z-10"
        style={{ paddingTop: 'max(0.875rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-2 min-w-0">
          {onVoltarSuperAdmin && (
            <button onClick={onVoltarSuperAdmin} className="text-stone-300 hover:text-white w-9 h-9 flex items-center justify-center shrink-0 active:scale-95 transition-transform">
              <ArrowLeft size={19} />
            </button>
          )}
          <span className="font-semibold text-[15px] truncate">{onVoltarSuperAdmin ? (restauranteDados?.nome || 'Painel do restaurante') : 'Painel do restaurante'}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setShowAdminMenu(true)}
            className="flex items-center gap-1.5 bg-white/10 px-3 min-h-[40px] rounded-xl text-sm font-medium active:scale-95 transition-transform">
            <Menu size={17} /> Menu
          </button>
          <button onClick={onLogout} className="text-stone-300 hover:text-white w-10 h-10 flex items-center justify-center active:scale-95 transition-transform"><LogOut size={19} /></button>
        </div>
      </div>

      {erro && <p className="text-sm text-red-600 bg-red-50 px-5 py-2">{erro}</p>}

      {licenca && (() => {
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        const dataExpira = licenca.expira_em ? new Date(licenca.expira_em + 'T00:00:00') : null;
        if (!dataExpira) return null;
        const dias = Math.round((dataExpira - hoje) / (1000 * 60 * 60 * 24));
        if (licenca.status === 'pausada' || dias < 0) {
          return (
            <div className="bg-red-50 border-b border-red-200 px-5 py-2.5">
              <p className="text-sm font-semibold text-red-700">Acesso suspenso</p>
              <p className="text-xs text-red-500">Entre em contato com o financeiro para regularizar.</p>
            </div>
          );
        }
        if (dias <= 7) {
          return (
            <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5">
              <p className="text-sm font-semibold text-amber-700">Sua licença vence em {dias} {dias === 1 ? 'dia' : 'dias'}</p>
              <p className="text-xs text-amber-600">Entre em contato com o financeiro para renovar e evitar interrupção.</p>
            </div>
          );
        }
        return null;
      })()}

      <div className="flex border-b border-stone-200 bg-white sticky top-[60px] z-10">
        <button onClick={() => setAba('cardapio')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${aba === 'cardapio' ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-400'}`}>
          Cardápio
        </button>
        <button onClick={() => setAba('relatorio')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${aba === 'relatorio' ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-400'}`}>
          Relatório
        </button>
      </div>

      {aba === 'relatorio' && (
        <div className="p-4 max-w-2xl mx-auto">
          <div className="flex gap-2 mb-4">
            <div className="flex-1">
              <label className="text-xs text-stone-500 mb-1 block">De</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-stone-500 mb-1 block">Até</label>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900" />
            </div>
          </div>

          {loadingRelatorio ? (
            <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-stone-400" /></div>
          ) : (
            <>
              {(() => {
                const validos = pedidosRelatorio.filter(p => !p.cancelado);
                const cancelados = pedidosRelatorio.filter(p => p.cancelado);
                return (
                  <div className="bg-stone-900 text-white rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-stone-400">Pedidos válidos</p>
                        <p className="text-2xl font-bold">{validos.length}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-stone-400">Total vendido</p>
                        <p className="text-2xl font-bold text-emerald-400">
                          {formatPreco(validos.reduce((s, p) => s + Number(p.total || 0), 0))}
                        </p>
                      </div>
                    </div>
                    {cancelados.length > 0 && (
                      <p className="text-xs text-stone-400 mt-2 pt-2 border-t border-white/10">
                        {cancelados.length} pedido{cancelados.length > 1 ? 's' : ''} cancelado{cancelados.length > 1 ? 's' : ''} — não contam no total
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="space-y-2">
                {pedidosRelatorio.map(p => (
                  <div key={p.id} className={`bg-white border rounded-xl p-3.5 ${p.cancelado ? 'border-red-200 bg-red-50/40 opacity-70' : 'border-stone-200'}`}>
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <p className="text-sm font-semibold text-stone-900">{p.cliente_nome || 'Cliente'}</p>
                      <p className={`text-sm font-bold ${p.cancelado ? 'text-red-500 line-through' : 'text-emerald-700'}`}>{formatPreco(p.total)}</p>
                    </div>
                    <p className="text-xs text-stone-400 mb-1.5">
                      {parseDataUTC(p.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Cuiaba' })}
                      {' · '}{p.tipo_entrega === 'mesa' ? p.local : `Entrega — ${p.local}`}
                      {' · '}{p.forma_pagamento}
                    </p>
                    <div className="text-xs text-stone-600 space-y-0.5 mb-2">
                      {(p.itens || []).map((it, idx) => (
                        <p key={idx}>{it.qtd}x {it.nome}{it.opcaoNome ? ` (${it.opcaoNome})` : ''}</p>
                      ))}
                    </div>
                    <button onClick={() => alternarCancelamento(p)}
                      className={`text-xs px-3 py-1.5 rounded-md font-medium ${p.cancelado ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                      {p.cancelado ? 'Reativar pedido' : 'Marcar como cancelado'}
                    </button>
                  </div>
                ))}
                {pedidosRelatorio.length === 0 && (
                  <p className="text-stone-400 text-sm text-center py-10">Nenhum pedido registrado nesse período.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {aba === 'cardapio' && (
      <div className="p-4 pb-28 space-y-6 max-w-2xl mx-auto">
        {categorias.map(cat => {
          const catItems = pratos.filter(p => p.categoria_id === cat.id).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
          return (
            <div key={cat.id}>
              <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">{cat.nome} · {catItems.length}</h3>
              <div className="space-y-2">
                {catItems.map((item, index) => (
                  <div key={item.id} className={`bg-white rounded-xl p-3 border ${item.disponivel ? 'border-stone-200' : 'border-stone-200 opacity-60'}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-6 shrink-0 pt-1 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-stone-100 text-stone-500 text-xs font-semibold">
                          {item.ordem ?? 0}
                        </span>
                      </div>
                      <div className="w-16 h-16 rounded-lg bg-stone-100 overflow-hidden shrink-0">
                        {item.foto_url ? <img src={item.foto_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={16} className="text-stone-300" /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-stone-900 text-sm">{item.nome}</span>
                          {item.destaque && <Flame size={12} className="text-orange-500 shrink-0" />}
                          {!item.disponivel && <span className="text-xs bg-stone-200 text-stone-600 px-1.5 py-0.5 rounded">Esgotado</span>}
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{item.descricao}</p>
                        <p className="text-sm font-semibold text-stone-900 mt-1">{formatPreco(item.preco)}</p>
                      </div>
                      <button onClick={() => toggleDisponivel(item)}
                        className={`shrink-0 text-xs px-3 min-h-[32px] rounded-md font-medium whitespace-nowrap active:scale-95 transition-transform ${item.disponivel ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                        {item.disponivel ? 'Disponível' : 'Reativar'}
                      </button>
                    </div>
                    <div className="flex gap-1.5 mt-2 pt-2 border-t border-stone-100">
                      <button onClick={() => setManagingOptions(item)} className="flex-1 text-stone-500 hover:text-stone-800 active:scale-95 transition-transform h-10 flex items-center justify-center bg-stone-50 rounded-lg" title="Opções/sabores"><ListPlus size={18} /></button>
                      <button onClick={() => { setEditing(item); setShowForm(true); }} className="flex-1 text-stone-500 hover:text-stone-800 active:scale-95 transition-transform h-10 flex items-center justify-center bg-stone-50 rounded-lg"><Edit2 size={18} /></button>
                      <button onClick={() => duplicarPrato(item)} className="flex-1 text-stone-500 hover:text-stone-800 active:scale-95 transition-transform h-10 flex items-center justify-center bg-stone-50 rounded-lg" title="Duplicar prato"><Copy size={18} /></button>
                      <button onClick={() => remove(item.id)} className="flex-1 text-stone-500 hover:text-red-600 active:scale-95 transition-transform h-10 flex items-center justify-center bg-stone-50 rounded-lg"><Trash2 size={18} /></button>
                    </div>
                  </div>
                ))}
                {catItems.length === 0 && <p className="text-sm text-stone-400">Nenhum prato neste grupo ainda.</p>}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {showForm && <ItemForm item={editing} categorias={categorias} token={token} onSave={save} onCancel={() => { setShowForm(false); setEditing(null); }} />}
      {showGroups && (
        <GroupManager
          token={token}
          categorias={categorias}
          restauranteId={restauranteId}
          onClose={() => setShowGroups(false)}
          onChanged={carregar}
        />
      )}
      {showProfile && (
        <ProfileEditor
          token={token}
          restauranteId={restauranteId}
          dadosAtuais={restauranteDados}
          onClose={() => setShowProfile(false)}
          onChanged={carregar}
        />
      )}
      {managingOptions && (
        <OptionsManager
          token={token}
          prato={managingOptions}
          onClose={() => setManagingOptions(null)}
        />
      )}
      {showDeliveryFees && (
        <DeliveryFeesManager
          token={token}
          restauranteId={restauranteId}
          onClose={() => setShowDeliveryFees(false)}
        />
      )}

      {/* Botão flutuante: Novo prato — ação mais usada, fácil de alcançar com o polegar */}
      {aba === 'cardapio' && (
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          style={{ bottom: 'max(1.25rem, calc(1rem + env(safe-area-inset-bottom)))' }}
          className="fixed right-4 bg-stone-900 text-white rounded-full pl-4 pr-5 h-14 shadow-xl flex items-center gap-2 font-semibold active:scale-95 transition-transform z-30">
          <Plus size={20} /> Novo prato
        </button>
      )}

      {/* Menu de ações administrativas */}
      {showAdminMenu && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setShowAdminMenu(false)}>
          <div className="bg-white w-full rounded-t-2xl p-4 pb-6" onClick={e => e.stopPropagation()}
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
            <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-4" />
            <div className="space-y-1.5">
              <button onClick={() => { setShowAdminMenu(false); setShowProfile(true); }}
                className="w-full flex items-center gap-3 px-4 min-h-[56px] rounded-xl hover:bg-stone-50 active:bg-stone-100 transition-colors text-left">
                <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center shrink-0"><User size={18} className="text-stone-700" /></div>
                <div>
                  <p className="text-sm font-semibold text-stone-900">Perfil do restaurante</p>
                  <p className="text-xs text-stone-400">Nome, capa, logo, horário, contato</p>
                </div>
              </button>
              <button onClick={() => { setShowAdminMenu(false); setShowGroups(true); }}
                className="w-full flex items-center gap-3 px-4 min-h-[56px] rounded-xl hover:bg-stone-50 active:bg-stone-100 transition-colors text-left">
                <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center shrink-0"><Layers size={18} className="text-stone-700" /></div>
                <div>
                  <p className="text-sm font-semibold text-stone-900">Grupos do cardápio</p>
                  <p className="text-xs text-stone-400">Criar, ordenar e remover categorias</p>
                </div>
              </button>
              <button onClick={() => { setShowAdminMenu(false); setShowDeliveryFees(true); }}
                className="w-full flex items-center gap-3 px-4 min-h-[56px] rounded-xl hover:bg-stone-50 active:bg-stone-100 transition-colors text-left">
                <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center shrink-0"><Truck size={18} className="text-stone-700" /></div>
                <div>
                  <p className="text-sm font-semibold text-stone-900">Taxas de entrega</p>
                  <p className="text-xs text-stone-400">Bairros atendidos e valores</p>
                </div>
              </button>
            </div>
            <button onClick={() => setShowAdminMenu(false)}
              className="w-full mt-4 py-3 rounded-xl border border-stone-200 text-stone-600 font-medium">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- ITEM DETALHE (cliente) ----------

function ItemModal({ item, onClose, pedidoHabilitado, onAddToCart }) {
  const [opcoes, setOpcoes] = useState([]);
  const [loadingOpcoes, setLoadingOpcoes] = useState(true);
  const [opcaoSelecionada, setOpcaoSelecionada] = useState(null);
  const [qtd, setQtd] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const dados = await sbFetch(`opcoes_produto?prato_id=eq.${item.id}&disponivel=eq.true&order=ordem`);
        setOpcoes(dados || []);
        if (dados && dados.length > 0) setOpcaoSelecionada(dados[0].id);
      } catch (e) { /* silencioso: item sem opções cadastradas */ }
      setLoadingOpcoes(false);
    })();
  }, [item.id]);

  // Trava o scroll da página de fundo enquanto o modal está aberto (evita bug de posicionamento no mobile)
  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  const opcaoAtual = opcoes.find(o => o.id === opcaoSelecionada);
  const precoUnitario = item.preco + (opcaoAtual?.preco_adicional || 0);

  const adicionar = () => {
    onAddToCart({
      pratoId: item.id,
      nome: item.nome,
      precoBase: item.preco,
      opcaoId: opcaoAtual?.id || null,
      opcaoNome: opcaoAtual?.nome || null,
      opcaoPrecoAdicional: opcaoAtual?.preco_adicional || 0,
      qtd,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-2xl overflow-hidden max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {item.foto_url && (
          <div className="w-full h-56 bg-stone-100 flex items-center justify-center overflow-hidden">
            <img src={item.foto_url} alt={item.nome} className="w-full h-full object-contain" />
          </div>
        )}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-xl font-serif text-stone-900">{item.nome}</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 shrink-0 transition-colors">
              <X size={16} />
            </button>
          </div>
          <p className="text-stone-500 text-sm leading-relaxed mt-2">{item.descricao}</p>
          <p className="text-lg font-semibold text-stone-900 mt-4">
            {opcoes.length > 0 && opcaoAtual ? formatPreco(precoUnitario) : formatPreco(item.preco)}
          </p>

          {!loadingOpcoes && opcoes.length > 0 && (
            <div className="mt-5 pt-4 border-t border-stone-100">
              <div className="flex items-center gap-1.5 mb-3">
                <ListPlus size={14} className="text-stone-900" />
                <p className="text-sm font-bold text-stone-900 uppercase tracking-wide">
                  {pedidoHabilitado ? 'Escolha uma opção' : 'Opções disponíveis'}
                </p>
              </div>
              <div className="space-y-2">
                {opcoes.map(op => (
                  pedidoHabilitado ? (
                    <button key={op.id} onClick={() => setOpcaoSelecionada(op.id)}
                      className={`w-full flex items-start justify-between gap-2 rounded-xl px-3.5 py-2.5 border-2 transition-colors text-left ${
                        opcaoSelecionada === op.id ? 'border-stone-900 bg-stone-50' : 'border-stone-200 bg-white'
                      }`}>
                      <div className="flex items-start gap-2 min-w-0">
                        <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${opcaoSelecionada === op.id ? 'border-stone-900' : 'border-stone-300'}`}>
                          {opcaoSelecionada === op.id && <span className="w-2 h-2 rounded-full bg-stone-900" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-stone-800">{op.nome}</p>
                          {op.descricao && <p className="text-xs text-stone-500 mt-0.5">{op.descricao}</p>}
                        </div>
                      </div>
                      {op.preco_adicional > 0 ? (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full shrink-0">+ {formatPreco(op.preco_adicional)}</span>
                      ) : (
                        <span className="text-xs font-medium text-stone-400 shrink-0">sem custo</span>
                      )}
                    </button>
                  ) : (
                    <div key={op.id} className="flex items-start justify-between gap-2 bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-800">{op.nome}</p>
                        {op.descricao && <p className="text-xs text-stone-500 mt-0.5">{op.descricao}</p>}
                      </div>
                      {op.preco_adicional > 0 ? (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full shrink-0">+ {formatPreco(op.preco_adicional)}</span>
                      ) : (
                        <span className="text-xs font-medium text-stone-400 shrink-0">sem custo</span>
                      )}
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {pedidoHabilitado && (
            <div className="mt-5 pt-4 border-t border-stone-100 flex items-center gap-3">
              <div className="flex items-center gap-3 bg-stone-100 rounded-full px-2 py-1.5">
                <button onClick={() => setQtd(q => Math.max(1, q - 1))} className="w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center text-stone-700"><Minus size={14} /></button>
                <span className="text-sm font-semibold w-4 text-center">{qtd}</span>
                <button onClick={() => setQtd(q => q + 1)} className="w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center text-stone-700"><Plus size={14} /></button>
              </div>
              <button onClick={adicionar}
                className="flex-1 bg-stone-900 text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2">
                Adicionar · {formatPreco(precoUnitario * qtd)}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- CARDÁPIO (cliente) ----------

function Checkout({ cart, setCart, restaurante, mesa, onClose }) {
  const statusLojaCheckout = calcularStatusAbertura(restaurante);
  const lojaAbertaCheckout = statusLojaCheckout ? statusLojaCheckout.aberto : true;
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [pagamento, setPagamento] = useState('Pix');
  const [tipoEntrega, setTipoEntrega] = useState(mesa ? 'mesa' : 'entrega'); // mesa | entrega
  const [local, setLocal] = useState(mesa ? `Mesa ${mesa}` : '');
  const [cep, setCep] = useState('');
  const [endereco, setEndereco] = useState({ rua: '', bairro: '', cidade: '' });
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erroCep, setErroCep] = useState('');
  const [taxaEntrega, setTaxaEntrega] = useState(null); // null = não calculada, 0 = grátis, >0 = valor
  const [taxaIndisponivel, setTaxaIndisponivel] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [naoSeiCep, setNaoSeiCep] = useState(false);
  const [bairrosDisponiveis, setBairrosDisponiveis] = useState([]);
  const [bairroSelecionado, setBairroSelecionado] = useState('');
  const [enderecoLivre, setEnderecoLivre] = useState('');
  const [ruaLivre, setRuaLivre] = useState('');
  const [bairroLivre, setBairroLivre] = useState('');

  useEffect(() => {
    if (!restaurante?.id) return;
    (async () => {
      try {
        const dados = await sbFetch(`taxas_entrega?restaurante_id=eq.${restaurante.id}&order=bairro`);
        setBairrosDisponiveis(dados || []);
      } catch (e) { /* silencioso */ }
    })();
  }, [restaurante?.id]);

  const selecionarBairro = (bairroNome) => {
    setBairroSelecionado(bairroNome);
    const encontrado = bairrosDisponiveis.find(b => b.bairro === bairroNome);
    if (encontrado) {
      setTaxaEntrega(encontrado.valor);
      setTaxaIndisponivel(false);
    } else {
      setTaxaEntrega(null);
      setTaxaIndisponivel(true);
    }
  };

  const totalItem = (c) => (c.precoBase + (c.opcaoPrecoAdicional || 0)) * c.qtd;
  const subtotal = cart.reduce((s, c) => s + totalItem(c), 0);
  const total = subtotal + (taxaEntrega || 0);

  const alterarQtd = (index, delta) => {
    setCart(prev => prev.map((c, i) => i === index ? { ...c, qtd: Math.max(1, c.qtd + delta) } : c));
  };
  const removerItem = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const buscarCep = async () => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) { setErroCep('CEP inválido.'); return; }
    setBuscandoCep(true);
    setErroCep('');
    setTaxaEntrega(null);
    setTaxaIndisponivel(false);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await res.json();
      if (data.erro) {
        setErroCep('CEP não encontrado.');
        setBuscandoCep(false);
        return;
      }
      setEndereco({ rua: data.logradouro || '', bairro: data.bairro || '', cidade: data.localidade || '' });

      // Busca a taxa de entrega cadastrada para esse bairro
      if (data.bairro && restaurante?.id) {
        try {
          const taxas = await sbFetch(`taxas_entrega?restaurante_id=eq.${restaurante.id}&bairro=ilike.${encodeURIComponent(data.bairro)}`);
          if (taxas && taxas.length > 0) {
            setTaxaEntrega(taxas[0].valor);
          } else {
            setTaxaIndisponivel(true);
          }
        } catch (e) {
          setTaxaIndisponivel(true);
        }
      }
    } catch (e) {
      setErroCep('Erro ao buscar o CEP. Tente novamente.');
    }
    setBuscandoCep(false);
  };

  const enderecoCompleto = naoSeiCep
    ? [
        ruaLivre && `${ruaLivre}, ${numero}${complemento ? ' - ' + complemento : ''}`,
        (bairroSelecionado === '__outro__' ? bairroLivre : bairroSelecionado) && `Bairro: ${bairroSelecionado === '__outro__' ? bairroLivre : bairroSelecionado}`,
      ].filter(Boolean).join(' — ')
    : (endereco.rua ? `${endereco.rua}, ${numero}${complemento ? ' - ' + complemento : ''} — ${endereco.bairro}, ${endereco.cidade}` : '');

  // Preenche automaticamente com os dados da última compra, se houver
  useEffect(() => {
    if (!restaurante?.id) return;
    const salvo = carregarDadosCliente(restaurante.id);
    if (!salvo) return;
    if (salvo.nome) setNome(salvo.nome);
    if (salvo.telefone) setTelefone(salvo.telefone);
    if (salvo.cep) {
      setCep(salvo.cep);
      setTimeout(() => { buscarCep(); }, 0);
    }
    if (salvo.numero) setNumero(salvo.numero);
    if (salvo.complemento) setComplemento(salvo.complemento);
    if (salvo.naoSeiCep) {
      setNaoSeiCep(true);
      if (salvo.ruaLivre) setRuaLivre(salvo.ruaLivre);
      if (salvo.enderecoLivre) setEnderecoLivre(salvo.enderecoLivre);
      if (salvo.bairroLivre) setBairroLivre(salvo.bairroLivre);
      if (salvo.bairroSelecionado) setBairroSelecionado(salvo.bairroSelecionado);
    }
  }, [restaurante?.id]);

  // Recalcula a taxa sempre que o bairro selecionado mudar (por CEP, cadastro salvo ou escolha manual)
  useEffect(() => {
    if (bairroSelecionado && bairroSelecionado !== '__outro__' && bairrosDisponiveis.length > 0) {
      selecionarBairro(bairroSelecionado);
    }
  }, [bairrosDisponiveis, bairroSelecionado]);

  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [clienteEncontrado, setClienteEncontrado] = useState(false);

  const buscarClientePorTelefone = async () => {
    const digitos = telefone.replace(/\D/g, '');
    if (digitos.length < 10 || !restaurante?.id) return;
    setBuscandoCliente(true);
    try {
      const dados = await sbFetch(`clientes?restaurante_id=eq.${restaurante.id}&telefone=eq.${digitos}&select=*`);
      if (dados && dados.length > 0) {
        const c = dados[0];
        setClienteEncontrado(true);
        if (c.nome) setNome(c.nome);
        if (c.cep) { setCep(c.cep); setTimeout(() => { buscarCep(); }, 0); }
        if (c.numero) setNumero(c.numero);
        if (c.complemento) setComplemento(c.complemento);
        if (c.nao_sei_cep) {
          setNaoSeiCep(true);
          if (c.rua_livre) setRuaLivre(c.rua_livre);
          if (c.endereco_livre) setEnderecoLivre(c.endereco_livre);
          if (c.bairro_livre) setBairroLivre(c.bairro_livre);
          if (c.bairro_selecionado) setBairroSelecionado(c.bairro_selecionado);
        }
      }
    } catch (e) { /* silencioso: cliente novo, sem cadastro ainda */ }
    setBuscandoCliente(false);
  };

  const podeEnviar = tipoEntrega === 'mesa'
    ? !!local
    : naoSeiCep
      ? !!(telefone && ruaLivre && numero && bairroSelecionado && bairroSelecionado !== '__outro__' && taxaEntrega != null)
      : !!(telefone && endereco.rua && numero && taxaEntrega != null);

  const enviarPedido = async () => {
    if (!restaurante?.whatsapp_pedido_numero) return;
    setEnviando(true);
    const linha = '- - - - - - - - - -';
    let msg = `🔔 *Novo pedido — ${restaurante.nome}*\n\n`;
    if (nome) msg += `👤 ${nome}\n\n`;
    if (telefone) msg += `📞 ${telefone}\n\n`;
    if (tipoEntrega === 'mesa') {
      if (local) msg += `📍 ${local}\n`;
    } else {
      msg += `📍 Entrega: ${enderecoCompleto}\n`;
    }
    msg += `${linha}\n`;
    cart.forEach(c => {
      msg += `${c.qtd}x ${c.nome}`;
      if (c.opcaoNome) msg += ` (${c.opcaoNome})`;
      msg += ` — ${formatPreco(totalItem(c))}\n`;
    });
    msg += `${linha}\n`;
    if (tipoEntrega === 'entrega') {
      msg += `🚴 Taxa de entrega: ${taxaEntrega != null ? formatPreco(taxaEntrega) : 'a combinar'}\n\n`;
    }
    msg += `💵 *Total: ${formatPreco(total)}*\n`;
    msg += `💳 Pagamento: ${pagamento}`;

    // Registra o pedido no histórico (não bloqueia o envio se falhar)
    try {
      await sbFetch('pedidos', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          restaurante_id: restaurante.id,
          cliente_nome: nome || null,
          cliente_telefone: telefone || null,
          tipo_entrega: tipoEntrega,
          local: tipoEntrega === 'mesa' ? local : enderecoCompleto,
          itens: cart.map(c => ({ nome: c.nome, qtd: c.qtd, opcaoNome: c.opcaoNome || null, precoUnit: c.precoBase + (c.opcaoPrecoAdicional || 0) })),
          subtotal,
          taxa_entrega: tipoEntrega === 'entrega' ? (taxaEntrega || 0) : 0,
          total,
          forma_pagamento: pagamento,
        }),
      });
    } catch (e) {
      console.error('Erro ao registrar pedido:', e);
    }

    // Salva os dados do cliente neste navegador, para a próxima compra já vir preenchida
    if (restaurante?.id) {
      salvarDadosCliente(restaurante.id, {
        nome, telefone, cep, numero, complemento,
        naoSeiCep, ruaLivre, enderecoLivre, bairroLivre, bairroSelecionado,
      });

      // Salva também no banco, vinculado ao telefone — funciona em qualquer aparelho
      const digitosTelefone = telefone.replace(/\D/g, '');
      if (digitosTelefone.length >= 10) {
        try {
          await sbFetch(`clientes?on_conflict=restaurante_id,telefone`, {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify({
              restaurante_id: restaurante.id,
              telefone: digitosTelefone,
              nome: nome || null,
              cep: cep || null,
              numero: numero || null,
              complemento: complemento || null,
              nao_sei_cep: naoSeiCep,
              rua_livre: ruaLivre || null,
              endereco_livre: enderecoLivre || null,
              bairro_livre: bairroLivre || null,
              bairro_selecionado: bairroSelecionado || null,
              atualizado_em: new Date().toISOString(),
            }),
          });
        } catch (e) { console.error('Erro ao salvar cadastro do cliente:', e); }
      }
    }

    const numeroRest = restaurante.whatsapp_pedido_numero.replace(/\D/g, '');
    const url = `https://wa.me/${numeroRest}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    setCart([]);
    setEnviando(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-stone-900">Finalizar pedido</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500"><X size={16} /></button>
        </div>

        <div className="space-y-2.5 mb-5">
          {cart.map((c, i) => (
            <div key={i} className="flex items-center justify-between gap-2 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800">{c.nome}</p>
                {c.opcaoNome && <p className="text-xs text-stone-500">{c.opcaoNome}</p>}
                <p className="text-xs font-semibold text-emerald-600 mt-0.5">{formatPreco(totalItem(c))}</p>
              </div>
              <div className="flex items-center gap-1.5 bg-white rounded-full border border-stone-200 px-1.5 py-1 shrink-0">
                <button onClick={() => alterarQtd(i, -1)} className="w-6 h-6 flex items-center justify-center text-stone-600"><Minus size={12} /></button>
                <span className="text-xs font-semibold w-3 text-center">{c.qtd}</span>
                <button onClick={() => alterarQtd(i, 1)} className="w-6 h-6 flex items-center justify-center text-stone-600"><Plus size={12} /></button>
              </div>
              <button onClick={() => removerItem(i)} className="text-stone-400 hover:text-red-600 shrink-0"><Trash2 size={14} /></button>
            </div>
          ))}
          {cart.length === 0 && <p className="text-sm text-stone-400 text-center py-6">Seu carrinho está vazio.</p>}
        </div>

        {cart.length > 0 && (
          <>
            <div className="flex gap-2 mb-4">
              <button onClick={() => setTipoEntrega('mesa')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border ${tipoEntrega === 'mesa' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-300'}`}>
                Retirar
              </button>
              <button onClick={() => setTipoEntrega('entrega')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border ${tipoEntrega === 'entrega' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-300'}`}>
                Entrega
              </button>
            </div>

            <div className="space-y-3 mb-5">
              {tipoEntrega === 'mesa' ? (
                <>
                  <div>
                    <label className="text-sm text-stone-600 mb-1 block">Seu nome</label>
                    <input value={nome} onChange={e => setNome(e.target.value)}
                      className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-900" placeholder="Nome" />
                  </div>
                  <div>
                    <label className="text-sm text-stone-600 mb-1 block">Mesa / local</label>
                    <input value={local} onChange={e => setLocal(e.target.value)}
                      className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-900" placeholder="Ex: Mesa 5" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-sm text-stone-600 mb-1 block">Telefone / WhatsApp</label>
                    <div className="relative">
                      <input value={telefone} onChange={e => { setTelefone(e.target.value); setClienteEncontrado(false); }} onBlur={buscarClientePorTelefone}
                        className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-900" placeholder="(65) 99999-9999" />
                      {buscandoCliente && <Loader2 size={16} className="animate-spin text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />}
                    </div>
                    {clienteEncontrado && !buscandoCliente && (
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-emerald-600">✓ Dados preenchidos automaticamente do seu último pedido</p>
                        <button onClick={() => {
                          setCep(''); setEndereco({ rua: '', bairro: '', cidade: '' }); setNumero(''); setComplemento('');
                          setRuaLivre(''); setBairroLivre(''); setBairroSelecionado(''); setTaxaEntrega(null); setTaxaIndisponivel(false);
                          setClienteEncontrado(false);
                        }} className="text-xs text-stone-500 underline shrink-0 ml-2">Usar outro endereço</button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm text-stone-600 mb-1 block">Seu nome</label>
                    <input value={nome} onChange={e => setNome(e.target.value)}
                      className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-900" placeholder="Nome" />
                  </div>

                  {!naoSeiCep ? (
                    <>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-sm text-stone-600 block">CEP</label>
                          <button onClick={() => { setNaoSeiCep(true); setEndereco({ rua: '', bairro: '', cidade: '' }); setTaxaEntrega(null); setTaxaIndisponivel(false); }}
                            className="text-xs text-orange-600 font-semibold underline decoration-orange-300 underline-offset-2 hover:text-orange-700">Não sei o CEP</button>
                        </div>
                        <div className="flex gap-2">
                          <input value={cep} onChange={e => setCep(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscarCep()}
                            className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-stone-900" placeholder="00000-000" />
                          <button onClick={buscarCep} disabled={buscandoCep}
                            className="bg-stone-900 text-white px-4 rounded-lg text-sm font-medium flex items-center gap-1.5">
                            {buscandoCep ? <Loader2 size={14} className="animate-spin" /> : 'Buscar'}
                          </button>
                        </div>
                        {erroCep && <p className="text-xs text-red-600 mt-1">{erroCep}</p>}
                      </div>

                      {endereco.rua && (
                        <>
                          <div className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-700">
                            {endereco.rua} — {endereco.bairro}, {endereco.cidade}
                          </div>
                          <div className="flex gap-2">
                            <input value={numero} onChange={e => setNumero(e.target.value)}
                              className="w-24 border border-stone-300 rounded-lg px-3 py-2 text-stone-900" placeholder="Número" />
                            <input value={complemento} onChange={e => setComplemento(e.target.value)}
                              className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-stone-900" placeholder="Complemento (opcional)" />
                          </div>
                          {taxaEntrega != null && (
                            <p className="text-sm text-emerald-700 font-medium">🛵 Taxa de entrega: {formatPreco(taxaEntrega)}</p>
                          )}
                          {taxaIndisponivel && (
                            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                              <p className="text-sm font-semibold text-red-700">Não entregamos no bairro {endereco.bairro}</p>
                              <p className="text-xs text-red-500 mt-0.5">Esse pedido não pode ser enviado para essa região. Escolha "Retirar" ou confira se digitou o CEP certo.</p>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-sm text-stone-600 block">
                            Bairro <span className="text-red-600 font-semibold">*obrigatório</span>
                          </label>
                          <button onClick={() => { setNaoSeiCep(false); setBairroSelecionado(''); setEnderecoLivre(''); setTaxaEntrega(null); setTaxaIndisponivel(false); }}
                            className="text-xs text-orange-600 font-semibold underline decoration-orange-300 underline-offset-2 hover:text-orange-700">Buscar por CEP</button>
                        </div>
                        {bairrosDisponiveis.length > 0 ? (
                          <select value={bairroSelecionado} onChange={e => selecionarBairro(e.target.value)}
                            className={`w-full border rounded-lg px-3 py-2 text-stone-900 ${!bairroSelecionado ? 'border-red-300 bg-red-50/40' : 'border-stone-300'}`}>
                            <option value="">Selecione seu bairro...</option>
                            {bairrosDisponiveis.map(b => (
                              <option key={b.id} value={b.bairro}>{b.bairro}</option>
                            ))}
                            <option value="__outro__">Meu bairro não está na lista</option>
                          </select>
                        ) : (
                          <p className="text-sm text-stone-400">Nenhum bairro cadastrado ainda — informe o endereço completo abaixo.</p>
                        )}
                      </div>

                      {(bairroSelecionado === '__outro__' || bairrosDisponiveis.length === 0) && (
                        <div>
                          <label className="text-sm text-stone-600 mb-1 block">Seu bairro</label>
                          <input value={bairroLivre} onChange={e => setBairroLivre(e.target.value)}
                            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-900" placeholder="Nome do bairro" />
                        </div>
                      )}

                      <div>
                        <label className="text-sm text-stone-600 mb-1 block">
                          Rua <span className="text-red-600 font-semibold">*obrigatório</span>
                        </label>
                        <input value={ruaLivre} onChange={e => setRuaLivre(e.target.value)}
                          className={`w-full border rounded-lg px-3 py-2 text-stone-900 ${!ruaLivre ? 'border-red-300 bg-red-50/40' : 'border-stone-300'}`}
                          placeholder="Ex: Rua das Palmeiras" />
                      </div>
                      <div className="flex gap-2">
                        <div className="w-24">
                          <label className="text-sm text-stone-600 mb-1 block">
                            Número <span className="text-red-600 font-semibold">*</span>
                          </label>
                          <input value={numero} onChange={e => setNumero(e.target.value)}
                            className={`w-full border rounded-lg px-3 py-2 text-stone-900 ${!numero ? 'border-red-300 bg-red-50/40' : 'border-stone-300'}`}
                            placeholder="123" />
                        </div>
                        <div className="flex-1">
                          <label className="text-sm text-stone-600 mb-1 block">Complemento (opcional)</label>
                          <input value={complemento} onChange={e => setComplemento(e.target.value)}
                            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-900" placeholder="Casa, apto, bloco..." />
                        </div>
                      </div>

                      {taxaEntrega != null && bairroSelecionado && bairroSelecionado !== '__outro__' && (
                        <p className="text-sm text-emerald-700 font-medium">🛵 Taxa de entrega: {formatPreco(taxaEntrega)}</p>
                      )}
                      {bairroSelecionado === '__outro__' && (
                        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                          <p className="text-sm font-semibold text-red-700">Não fazemos entrega para esse bairro</p>
                          <p className="text-xs text-red-500 mt-0.5">Esse pedido não pode ser enviado. Escolha "Retirar" ou um bairro da lista.</p>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              <div>
                <label className="text-sm text-stone-600 mb-1 block">Forma de pagamento</label>
                <select value={pagamento} onChange={e => setPagamento(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-900">
                  <option>Pix</option>
                  <option>Cartão</option>
                  <option>Dinheiro</option>
                </select>
              </div>
            </div>

            <div className="space-y-1 mb-4 pt-3 border-t border-stone-200">
              <div className="flex items-center justify-between text-sm text-stone-500">
                <span>Subtotal</span>
                <span>{formatPreco(subtotal)}</span>
              </div>
              {tipoEntrega === 'entrega' && taxaEntrega != null && (
                <div className="flex items-center justify-between text-sm text-stone-500">
                  <span>Taxa de entrega</span>
                  <span>{formatPreco(taxaEntrega)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-medium text-stone-600">Total</span>
                <span className="text-lg font-bold text-stone-900">{formatPreco(total)}</span>
              </div>
            </div>

            {!lojaAbertaCheckout && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-center">
                <p className="text-sm font-semibold text-red-700">A loja está fechada no momento</p>
                <p className="text-xs text-red-500 mt-0.5">Não é possível finalizar o pedido agora. Tente novamente durante o horário de funcionamento.</p>
              </div>
            )}

            <button onClick={enviarPedido} disabled={enviando || !podeEnviar || !lojaAbertaCheckout}
              className="w-full bg-emerald-600 disabled:bg-stone-300 text-white py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2">
              <MessageCircle size={18} /> Enviar pedido pelo WhatsApp
            </button>
            <p className="text-xs text-stone-400 text-center mt-2">Você será direcionado ao WhatsApp do restaurante para confirmar.</p>
          </>
        )}
      </div>
    </div>
  );
}

function ClientView({ onAdmin }) {
  const [pratos, setPratos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [restaurante, setRestaurante] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [activeCat, setActiveCat] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busca, setBusca] = useState('');
  const [cart, setCart] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showContato, setShowContato] = useState(false);
  const [licenca, setLicenca] = useState(null);
  const mesa = new URLSearchParams(window.location.search).get('mesa');
  const acessoPainel = new URLSearchParams(window.location.search).get('painel') === '1';

  useEffect(() => {
    (async () => {
      try {
        const slugRestaurante = getSlugDaUrl() || RESTAURANTE_SLUG;
        const rest = await sbFetch(`restaurantes?slug=eq.${slugRestaurante}&select=id,nome,logo_url,capa_url,endereco,horario_texto,instagram_url,whatsapp_url,hora_abertura,hora_fechamento,pedido_habilitado,whatsapp_pedido_numero,status_manual,dias_funcionamento,formas_pagamento,endereco_completo`);
        const rst = rest[0];
        if (!rst) { setErro('Restaurante não encontrado.'); setLoading(false); return; }
        setRestaurante(rst);

        try {
          const lics = await sbFetch(`licencas?restaurante_id=eq.${rst.id}&select=status,expira_em`);
          if (lics && lics.length > 0) setLicenca(lics[0]);
        } catch (e) { /* sem licença cadastrada, segue liberado */ }

        const [cats, prts] = await Promise.all([
          sbFetch(`categorias?restaurante_id=eq.${rst.id}&order=ordem`),
          sbFetch(`pratos?restaurante_id=eq.${rst.id}&disponivel=eq.true&select=*`),
        ]);
        setCategorias(cats);
        setPratos(prts);
        if (cats[0]) setActiveCat(cats[0].id);
      } catch (e) {
        setErro('Erro ao carregar cardápio: ' + e.message);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-stone-400" size={28} /></div>;
  }
  if (erro) {
    return <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center text-stone-500 text-sm">{erro}</div>;
  }

  if (licenca) {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dataExpira = licenca.expira_em ? new Date(licenca.expira_em + 'T00:00:00') : null;
    const bloqueado = licenca.status === 'pausada' || (dataExpira && dataExpira < hoje);
    if (bloqueado) {
      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
          <div className="text-center max-w-xs">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <X size={24} className="text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-stone-900 mb-1.5">Acesso suspenso</h2>
            <p className="text-sm text-stone-500">Este cardápio está temporariamente indisponível. Entre em contato com o financeiro para regularizar o acesso.</p>
          </div>
        </div>
      );
    }
  }

  const scrollToCategory = (id) => {
    setActiveCat(id);
    const el = document.getElementById(`cat-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const statusLoja = calcularStatusAbertura(restaurante);
  const lojaAberta = statusLoja ? statusLoja.aberto : true; // se não há horário configurado, assume aberto
  const pedidoDisponivel = !!(restaurante?.pedido_habilitado && restaurante?.whatsapp_pedido_numero && lojaAberta);

  return (
    <div className="min-h-screen bg-stone-50" style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}>
      {/* Capa */}
      <div className="relative h-56 bg-stone-800 overflow-hidden">
        {restaurante?.capa_url && (
          <img src={restaurante.capa_url} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-7 bg-stone-50 rounded-t-[26px] border-t-[3px] border-orange-500" />

        {acessoPainel && (
          <button onClick={onAdmin} title="Painel do restaurante"
            style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}
            className="absolute left-3 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white active:scale-95 hover:bg-black/50 transition-all">
            <ChefHat size={16} />
          </button>
        )}

        {(restaurante?.instagram_url || restaurante?.whatsapp_url) && (
          <div className="absolute right-3 flex gap-2" style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}>
            {restaurante?.instagram_url && (
              <a href={restaurante.instagram_url} target="_blank" rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center active:scale-95 hover:scale-110 transition-transform">
                <Instagram size={16} className="text-pink-600" />
              </a>
            )}
            {restaurante?.whatsapp_url && (
              <a href={whatsappHref(restaurante.whatsapp_url)} target="_blank" rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center active:scale-95 hover:scale-110 transition-transform">
                <MessageCircle size={16} className="text-emerald-600" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Avatar sobreposto + info, centralizados */}
      <div className="px-5 -mt-14 relative flex flex-col items-center text-center">
        <div className="w-24 h-24 rounded-full border-[5px] border-stone-50 bg-white overflow-hidden shadow-lg">
          {restaurante?.logo_url
            ? <img src={restaurante.logo_url} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center bg-stone-100"><ChefHat size={34} className="text-stone-400" /></div>}
        </div>
        <div className="mt-2.5">
          <h1 className="text-xl font-bold text-stone-900">{restaurante?.nome || 'Restaurante'}</h1>
          {restaurante?.endereco && (
            <p className="text-stone-500 text-sm mt-0.5">{restaurante.endereco}</p>
          )}
          {(() => {
            const status = statusLoja;
            if (status) {
              return (
                <p className={`text-sm font-medium mt-0.5 flex items-center justify-center gap-1.5 ${status.aberto ? 'text-emerald-600' : 'text-red-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status.aberto ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  {status.texto}
                </p>
              );
            }
            if (restaurante?.horario_texto) {
              return <p className="text-emerald-600 text-sm font-medium mt-0.5">{restaurante.horario_texto}</p>;
            }
            return null;
          })()}
          {mesa && (
            <p className="text-stone-400 text-xs mt-1 uppercase tracking-wide">Mesa {mesa}</p>
          )}
        </div>
      </div>

      {/* Carrossel de destaques */}
      {pratos.some(p => p.destaque) && (
        <div className="pt-5 pb-1 relative">
          <div className="flex items-center gap-1.5 px-5 mb-2.5">
            <Flame size={15} className="text-orange-500" />
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wide">Destaques da casa</h2>
          </div>
          <div className="relative">
            <div className="flex gap-3 overflow-x-auto px-5 pb-2 snap-x snap-mandatory scroll-pl-5">
              {pratos.filter(p => p.destaque).sort((a, b) => (a.ordem_destaque ?? 0) - (b.ordem_destaque ?? 0)).map(item => (
                <button key={item.id} onClick={() => setSelected(item)}
                  className="snap-start shrink-0 w-36 bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow text-left">
                  <div className="w-full h-28 bg-stone-100 relative">
                    {item.foto_url
                      ? <img src={item.foto_url} alt={item.nome} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={18} className="text-stone-300" /></div>}
                    <span className="absolute top-1.5 left-1.5 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                      DESTAQUE
                    </span>
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold text-stone-900 leading-snug line-clamp-2">{item.nome}</p>
                    <p className="text-emerald-600 text-sm font-bold mt-1">{formatPreco(item.preco)}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="pointer-events-none absolute top-0 right-0 bottom-2 w-10 bg-gradient-to-l from-stone-50 to-transparent" />
          </div>
        </div>
      )}

      {/* Barra de busca */}
      <div className="px-3 pt-4">
        <div className="relative max-w-3xl mx-auto">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar no cardápio..."
            className="w-full bg-white border-2 border-stone-200 focus:border-stone-900 rounded-full pl-10 pr-4 py-2.5 text-sm text-stone-900 shadow-sm outline-none transition-colors"
          />
        </div>
      </div>

      {/* Abas fixas de categoria */}
      {!busca && (
      <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-stone-200 flex gap-2 overflow-x-auto z-10 px-3 py-2.5 shadow-sm mt-4">
        {categorias.map(cat => (
          <button key={cat.id} onClick={() => scrollToCategory(cat.id)}
            className={`px-4 min-h-[38px] text-sm font-semibold whitespace-nowrap rounded-full transition-all duration-200 shadow-sm active:scale-95 hover:shadow-md hover:-translate-y-0.5 ${
              activeCat === cat.id ? 'bg-orange-500 text-white shadow-orange-200' : 'bg-white text-stone-500 border border-stone-200'
            }`}>
            {cat.nome}
          </button>
        ))}
      </div>
      )}

      {/* Resultado da busca (lista plana) */}
      {busca && (
        <div className="px-3 py-5 max-w-3xl mx-auto">
          {(() => {
            const resultado = pratos.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()));
            if (resultado.length === 0) {
              return <p className="text-stone-400 text-sm text-center py-10">Nenhum prato encontrado para "{busca}".</p>;
            }
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {resultado.map(item => (
                  <button key={item.id} onClick={() => setSelected(item)}
                    className="group w-full flex items-center justify-between gap-3 bg-white border border-stone-200 rounded-2xl p-3 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-stone-300 transition-all duration-200 text-left">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-stone-900 text-[15px] leading-snug">{item.nome}</p>
                      <p className="text-sm text-stone-500 mt-1 line-clamp-2 leading-snug">{item.descricao}</p>
                      <p className="text-emerald-600 font-bold mt-1.5">{formatPreco(item.preco)}</p>
                    </div>
                    <div className="relative w-24 h-24 rounded-xl bg-stone-100 overflow-hidden shrink-0">
                      {item.foto_url
                        ? <img src={item.foto_url} alt={item.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={18} className="text-stone-300" /></div>}
                    </div>
                  </button>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Lista de pratos agrupada por categoria */}
      {!busca && (
      <div className="px-3 py-5 max-w-3xl mx-auto space-y-7">
        {categorias.map(cat => {
          const itensCat = pratos.filter(p => p.categoria_id === cat.id).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
          if (itensCat.length === 0) return null;
          return (
            <div key={cat.id} id={`cat-${cat.id}`}>
              <h2 className="text-lg font-bold text-stone-900 mb-1 px-1">{cat.nome}</h2>
              {cat.descricao && <p className="text-sm text-stone-500 mb-2 px-1">{cat.descricao}</p>}
              <div className="h-px bg-stone-200 mb-3.5" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {itensCat.map(item => (
                  <button key={item.id} onClick={() => setSelected(item)}
                    className="group w-full flex items-center justify-between gap-3 bg-white border border-stone-200 rounded-2xl p-3 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-stone-300 transition-all duration-200 text-left">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-stone-900 text-[15px] leading-snug">{item.nome}</p>
                      <p className="text-sm text-stone-500 mt-1 line-clamp-2 leading-snug">{item.descricao}</p>
                      <p className="text-emerald-600 font-bold mt-1.5">{formatPreco(item.preco)}</p>
                    </div>
                    <div className="relative w-24 h-24 rounded-xl bg-stone-100 overflow-hidden shrink-0">
                      {item.foto_url
                        ? <img src={item.foto_url} alt={item.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={18} className="text-stone-300" /></div>}
                      {item.destaque && (
                        <span className="absolute top-1 left-1 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow">
                          <Flame size={10} /> Top
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {pratos.length === 0 && <p className="text-stone-400 text-sm text-center py-10">Cardápio ainda sem pratos cadastrados.</p>}
      </div>
      )}

      {/* Marca do SaaS, discreta no rodapé */}
      <div className="flex items-center justify-center gap-1.5 py-5 opacity-50">
        {MARCA_LOGO_URL && <img src={MARCA_LOGO_URL} alt="" className="w-4 h-4 rounded-full object-cover" />}
        <span className="text-[11px] text-stone-400">Cardápio via {MARCA_NOME}</span>
      </div>

      {/* Barra de navegação inferior */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 flex items-stretch justify-around px-2 pt-2 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] z-30"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex-1 flex flex-col items-center justify-center gap-1 min-h-[48px] mx-1 rounded-2xl text-orange-600 bg-orange-50 shadow-sm transition-all duration-200 active:scale-95 hover:-translate-y-0.5 hover:shadow-md">
          <ReceiptText size={20} />
          <span className="text-[11px] font-semibold">Cardápio</span>
        </button>

        {pedidoDisponivel && (
          <button onClick={() => setShowCheckout(true)}
            className="flex-1 relative flex flex-col items-center justify-center gap-1 min-h-[48px] mx-1 rounded-2xl text-stone-500 transition-all duration-200 active:scale-95 hover:-translate-y-0.5 hover:shadow-md hover:bg-orange-50 hover:text-orange-600">
            <ShoppingBag size={20} />
            <span className="text-[11px] font-medium">Pedidos</span>
            {cart.length > 0 && (
              <span className="absolute top-0.5 right-4 bg-orange-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {cart.reduce((s, c) => s + c.qtd, 0)}
              </span>
            )}
          </button>
        )}

        <button onClick={() => setShowContato(true)}
          className="flex-1 flex flex-col items-center justify-center gap-1 min-h-[48px] mx-1 rounded-2xl text-stone-500 transition-all duration-200 active:scale-95 hover:-translate-y-0.5 hover:shadow-md hover:bg-orange-50 hover:text-orange-600">
          <Phone size={20} />
          <span className="text-[11px] font-medium">Perfil</span>
        </button>
      </div>

      {/* Barra flutuante do carrinho */}
      {pedidoDisponivel && cart.length > 0 && (
        <button onClick={() => setShowCheckout(true)}
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
          className="fixed left-3 right-3 max-w-3xl mx-auto bg-stone-900 text-white rounded-2xl px-5 py-4 shadow-lg flex items-center justify-between z-20 active:scale-[0.98] transition-transform">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingBag size={16} />
            {cart.reduce((s, c) => s + c.qtd, 0)} {cart.reduce((s, c) => s + c.qtd, 0) === 1 ? 'item' : 'itens'}
          </span>
          <span className="font-bold">
            {formatPreco(cart.reduce((s, c) => s + (c.precoBase + (c.opcaoPrecoAdicional || 0)) * c.qtd, 0))}
          </span>
        </button>
      )}

      {showContato && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setShowContato(false)}>
          <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-stone-900">Perfil da Loja</h3>
              <button onClick={() => setShowContato(false)} className="w-9 h-9 rounded-lg bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500"><X size={18} /></button>
            </div>

            <div className="space-y-5">
              {(restaurante?.hora_abertura && restaurante?.hora_fechamento) && (
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-stone-100 flex items-center justify-center shrink-0"><Clock size={20} className="text-stone-600" /></div>
                  <div className="flex-1">
                    <p className="text-base font-bold text-stone-900 mb-1.5">Horário de atendimento</p>
                    <div className="space-y-1">
                      {listaHorarioSemanal(restaurante.dias_funcionamento, restaurante.hora_abertura, restaurante.hora_fechamento).map(d => (
                        <div key={d.dia} className="flex items-center justify-between text-base">
                          <span className="text-stone-600">{d.dia}</span>
                          <span className={d.aberto ? 'text-stone-900 font-medium' : 'text-red-500 font-medium'}>{d.texto}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {restaurante?.formas_pagamento && (
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-stone-100 flex items-center justify-center shrink-0"><Wallet size={20} className="text-stone-600" /></div>
                  <div>
                    <p className="text-base font-bold text-stone-900 mb-1.5">Formas de pagamento</p>
                    <div className="flex flex-wrap gap-1.5">
                      {restaurante.formas_pagamento.split(',').filter(Boolean).map(forma => (
                        <span key={forma} className="text-sm bg-stone-100 text-stone-700 px-2.5 py-1.5 rounded-full font-medium">{forma}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {(restaurante?.endereco_completo || restaurante?.endereco) && (
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-stone-100 flex items-center justify-center shrink-0"><MapPin size={20} className="text-stone-600" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-stone-900">Endereço</p>
                    <p className="text-base text-stone-600">{restaurante.endereco_completo || restaurante.endereco}</p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurante.endereco_completo || restaurante.endereco)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-orange-600 font-bold underline decoration-orange-300 underline-offset-2 mt-1">
                      Ver no mapa
                    </a>
                  </div>
                </div>
              )}

              {(restaurante?.instagram_url || restaurante?.whatsapp_url) && (
                <div className="pt-2 border-t border-stone-100 space-y-2.5">
                  {restaurante?.instagram_url && (
                    <a href={restaurante.instagram_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 border border-stone-200 rounded-xl px-4 py-3.5 hover:bg-stone-50 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-pink-50 flex items-center justify-center shrink-0">
                        <Instagram size={19} className="text-pink-600" />
                      </div>
                      <span className="text-base font-medium text-stone-800">Seguir no Instagram</span>
                    </a>
                  )}
                  {restaurante?.whatsapp_url && (
                    <a href={whatsappHref(restaurante.whatsapp_url)} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 border border-stone-200 rounded-xl px-4 py-3.5 hover:bg-stone-50 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                        <MessageCircle size={19} className="text-emerald-600" />
                      </div>
                      <span className="text-base font-medium text-stone-800">Conversar no WhatsApp</span>
                    </a>
                  )}
                </div>
              )}

              {!restaurante?.hora_abertura && !restaurante?.formas_pagamento && !restaurante?.endereco_completo && !restaurante?.endereco && !restaurante?.instagram_url && !restaurante?.whatsapp_url && (
                <p className="text-base text-stone-400 text-center py-6">Nenhuma informação cadastrada ainda.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {selected && (
        <ItemModal
          item={selected}
          onClose={() => setSelected(null)}
          pedidoHabilitado={pedidoDisponivel}
          onAddToCart={(novoItem) => setCart(prev => [...prev, novoItem])}
        />
      )}

      {showCheckout && (
        <Checkout
          cart={cart}
          setCart={setCart}
          restaurante={restaurante}
          mesa={mesa}
          onClose={() => setShowCheckout(false)}
        />
      )}
    </div>
  );
}

// ---------- APP ----------

// ---------- SUPER ADMIN (dono do sistema) ----------

function SuperAdminPanel({ token, onLogout, onManage }) {
  const [restaurantes, setRestaurantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [salvandoId, setSalvandoId] = useState(null);
  const authHeaders = { Authorization: `Bearer ${token}` };

  const carregar = async () => {
    setLoading(true);
    try {
      const [rests, lics] = await Promise.all([
        sbFetch(`restaurantes?select=id,nome,slug,logo_url&order=nome`, { headers: authHeaders }),
        sbFetch(`licencas?select=id,restaurante_id,status,expira_em`, { headers: authHeaders }),
      ]);
      const licPorRestaurante = {};
      (lics || []).forEach(l => { licPorRestaurante[l.restaurante_id] = l; });
      const combinado = (rests || []).map(r => ({
        ...r,
        licencas: licPorRestaurante[r.id] ? [licPorRestaurante[r.id]] : [],
      }));
      setRestaurantes(combinado);
    } catch (e) {
      setErro('Erro ao carregar restaurantes: ' + e.message);
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const diasRestantes = (expiraEm) => {
    if (!expiraEm) return null;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const data = new Date(expiraEm + 'T00:00:00');
    return Math.round((data - hoje) / (1000 * 60 * 60 * 24));
  };

  const statusVisual = (rest) => {
    const lic = rest.licencas?.[0];
    if (!lic) return { texto: 'Sem licença', cor: 'bg-stone-100 text-stone-500' };
    if (lic.status === 'pausada') return { texto: 'Pausada', cor: 'bg-red-100 text-red-700' };
    const dias = diasRestantes(lic.expira_em);
    if (dias < 0) return { texto: 'Expirada', cor: 'bg-red-100 text-red-700' };
    if (dias <= 7) return { texto: `Vence em ${dias}d`, cor: 'bg-amber-100 text-amber-700' };
    return { texto: 'Ativa', cor: 'bg-emerald-100 text-emerald-700' };
  };

  const salvarLicenca = async (rest, novosDados) => {
    setSalvandoId(rest.id);
    setErro('');
    try {
      const lic = rest.licencas?.[0];
      if (lic) {
        await sbFetch(`licencas?id=eq.${lic.id}`, {
          method: 'PATCH', headers: authHeaders,
          body: JSON.stringify({ ...novosDados, atualizado_em: new Date().toISOString() }),
        });
      } else {
        await sbFetch('licencas', {
          method: 'POST', headers: authHeaders,
          body: JSON.stringify({ restaurante_id: rest.id, status: 'ativa', expira_em: new Date().toISOString().slice(0, 10), ...novosDados }),
        });
      }
      carregar();
    } catch (e) {
      setErro('Erro ao salvar: ' + e.message);
    }
    setSalvandoId(null);
  };

  const adicionarDias = (rest, dias) => {
    const lic = rest.licencas?.[0];
    const base = lic?.expira_em ? new Date(lic.expira_em + 'T00:00:00') : new Date();
    base.setDate(base.getDate() + dias);
    salvarLicenca(rest, { expira_em: base.toISOString().slice(0, 10), status: 'ativa' });
  };

  const alternarPausa = (rest) => {
    const lic = rest.licencas?.[0];
    const pausada = lic?.status === 'pausada';
    salvarLicenca(rest, { status: pausada ? 'ativa' : 'pausada' });
  };

  if (loading) {
    return <div className="min-h-screen bg-stone-50 flex items-center justify-center"><Loader2 className="animate-spin text-stone-400" size={28} /></div>;
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-stone-900 text-white px-5 py-4 flex items-center justify-between sticky top-0 z-10"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <span className="font-semibold">Super Admin — Restaurantes</span>
        <button onClick={onLogout} className="text-stone-300 hover:text-white p-1.5"><LogOut size={19} /></button>
      </div>

      {erro && <p className="text-sm text-red-600 bg-red-50 px-5 py-2">{erro}</p>}

      <div className="p-4 space-y-3 max-w-2xl mx-auto">
        {restaurantes.map(rest => {
          const lic = rest.licencas?.[0];
          const status = statusVisual(rest);
          const salvandoEsse = salvandoId === rest.id;
          return (
            <div key={rest.id} className="bg-white border border-stone-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-stone-900 truncate">{rest.nome}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${status.cor}`}>{status.texto}</span>
                </div>
              </div>
              <p className="text-xs text-stone-400 mb-3">/{rest.slug}</p>

              <div className="flex items-center gap-2 mb-3">
                <label className="text-xs text-stone-500">Vence em:</label>
                <input type="date" defaultValue={lic?.expira_em || ''}
                  onBlur={e => e.target.value && salvarLicenca(rest, { expira_em: e.target.value })}
                  className="border border-stone-300 rounded-lg px-2 py-1 text-sm text-stone-900" />
              </div>

              <div className="flex flex-wrap gap-2 mb-2">
                <button onClick={() => onManage(rest.slug)}
                  className="text-xs bg-stone-900 text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5">
                  <User size={13} /> Ver painel do restaurante
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => adicionarDias(rest, 1)} disabled={salvandoEsse}
                  className="text-xs bg-stone-100 text-stone-700 px-3 py-1.5 rounded-lg font-medium">+1 dia</button>
                <button onClick={() => adicionarDias(rest, 7)} disabled={salvandoEsse}
                  className="text-xs bg-stone-100 text-stone-700 px-3 py-1.5 rounded-lg font-medium">+7 dias</button>
                <button onClick={() => adicionarDias(rest, 30)} disabled={salvandoEsse}
                  className="text-xs bg-stone-100 text-stone-700 px-3 py-1.5 rounded-lg font-medium">+30 dias</button>
                <button onClick={() => alternarPausa(rest)} disabled={salvandoEsse}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium ${lic?.status === 'pausada' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {salvandoEsse ? <Loader2 size={12} className="animate-spin" /> : lic?.status === 'pausada' ? 'Reativar agora' : 'Pausar agora'}
                </button>
              </div>
            </div>
          );
        })}
        {restaurantes.length === 0 && <p className="text-stone-400 text-sm text-center py-10">Nenhum restaurante cadastrado ainda.</p>}
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState('client'); // client | login | checking | admin | superadmin
  const [token, setToken] = useState(null);
  const [userId, setUserId] = useState(null);
  const [manageSlug, setManageSlug] = useState(() => getSlugDaUrl());
  const [viaSuperAdmin, setViaSuperAdmin] = useState(false);

  useEffect(() => {
    if (view !== 'checking' || !token || !userId) return;
    (async () => {
      try {
        const superAdmins = await sbFetch(`super_admins?id=eq.${userId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (superAdmins && superAdmins.length > 0) {
          setView('superadmin');
        } else {
          setView('admin');
        }
      } catch (e) {
        setView('admin');
      }
    })();
  }, [view, token, userId]);

  if (view === 'checking') {
    return <div className="min-h-screen bg-stone-50 flex items-center justify-center"><Loader2 className="animate-spin text-stone-400" size={28} /></div>;
  }
  if (view === 'superadmin' && token) {
    return (
      <SuperAdminPanel
        token={token}
        onLogout={() => { setToken(null); setUserId(null); setView('client'); }}
        onManage={(slug) => { setManageSlug(slug); setViaSuperAdmin(true); setView('admin'); }}
      />
    );
  }
  if (view === 'admin' && token) {
    return (
      <AdminView
        token={token}
        slugOverride={manageSlug}
        onVoltarSuperAdmin={viaSuperAdmin ? () => { setManageSlug(getSlugDaUrl()); setViaSuperAdmin(false); setView('superadmin'); } : undefined}
        onLogout={() => { setToken(null); setUserId(null); setManageSlug(getSlugDaUrl()); setViaSuperAdmin(false); setView('client'); }}
      />
    );
  }
  if (view === 'login') {
    return <LoginScreen onLogin={(tok, uid) => { setToken(tok); setUserId(uid); setView('checking'); }} onBack={() => setView('client')} />;
  }
  return <ClientView onAdmin={() => setView('login')} />;
}
