import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, X, ChefHat, ArrowLeft, Flame, Image as ImageIcon, Search, LogOut, Loader2, Bell, Check, Instagram, MessageCircle, ListPlus } from 'lucide-react';

const SUPABASE_URL = 'https://xzipsbuwsjyzgsfasygc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6aXBzYnV3c2p5emdzZmFzeWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNDc0NTYsImV4cCI6MjEwMjcyMzQ1Nn0.6k5ocACvG-ihQyPhmdquEriavxK7Un6E3LSECz8J5GA';
const RESTAURANTE_SLUG = 'restaurante-raiz';

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

// Calcula se o restaurante está aberto agora, com base em hora_abertura/hora_fechamento ("HH:MM")
function calcularStatusAbertura(horaAbertura, horaFechamento) {
  if (!horaAbertura || !horaFechamento) return null;
  const agora = new Date();
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

  const [hA, mA] = horaAbertura.split(':').map(Number);
  const [hF, mF] = horaFechamento.split(':').map(Number);
  const minutosAbertura = hA * 60 + mA;
  const minutosFechamento = hF * 60 + mF;

  let aberto;
  if (minutosFechamento > minutosAbertura) {
    // Não cruza a meia-noite (ex: 18:00 - 23:00)
    aberto = minutosAgora >= minutosAbertura && minutosAgora < minutosFechamento;
  } else {
    // Cruza a meia-noite (ex: 18:00 - 02:00)
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-stone-900">Grupos do cardápio</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X size={20} /></button>
        </div>
        <p className="text-xs text-stone-400 mb-2">Defina o número de ordem de cada grupo. Menor número aparece primeiro.</p>
        <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
          {ordenadas.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2 gap-2">
              <span className="text-sm text-stone-800 flex-1 truncate">{cat.nome}</span>
              <input
                type="number"
                defaultValue={cat.ordem ?? 0}
                onChange={e => setOrdens(o => ({ ...o, [cat.id]: parseInt(e.target.value) || 0 }))}
                onBlur={() => salvarOrdem(cat)}
                className="w-14 border border-stone-300 rounded-md px-2 py-1 text-sm text-stone-900 text-center"
              />
              <button onClick={() => removeGroup(cat)} className="text-stone-400 hover:text-red-600"><Trash2 size={14} /></button>
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
            <label className="text-sm text-stone-600 mb-1 block flex items-center gap-1.5"><Instagram size={13} /> Instagram</label>
            <input value={form.instagram_url} onChange={e => setForm({...form, instagram_url: e.target.value})}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-900" placeholder="https://instagram.com/seurestaurante" />
          </div>
          <div>
            <label className="text-sm text-stone-600 mb-1 block flex items-center gap-1.5"><MessageCircle size={13} /> WhatsApp</label>
            <input value={form.whatsapp_url} onChange={e => setForm({...form, whatsapp_url: e.target.value})}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-900" placeholder="https://wa.me/5511999999999" />
            <p className="text-xs text-stone-400 mt-1">Formato: https://wa.me/55DDDNUMERO (só números, com código do país)</p>
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
  const [novo, setNovo] = useState({ nome: '', preco_adicional: '' });
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

  const addOpcao = async () => {
    if (!novo.nome.trim()) return;
    setSaving(true);
    setErro('');
    try {
      const proximaOrdem = opcoes.length > 0 ? Math.max(...opcoes.map(o => o.ordem || 0)) + 1 : 1;
      await sbFetch('opcoes_produto', {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({
          prato_id: prato.id,
          nome: novo.nome.trim(),
          preco_adicional: parseFloat(novo.preco_adicional) || 0,
          disponivel: true,
          ordem: proximaOrdem,
        }),
      });
      setNovo({ nome: '', preco_adicional: '' });
      carregar();
    } catch (e) {
      setErro('Erro ao adicionar: ' + e.message);
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
              <div key={op.id} className={`flex items-center justify-between rounded-lg px-3 py-2 gap-2 ${op.disponivel ? 'bg-stone-50' : 'bg-stone-100 opacity-60'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-800 truncate">{op.nome}</p>
                  {op.preco_adicional > 0 && (
                    <p className="text-xs text-emerald-600">+ {formatPreco(op.preco_adicional)}</p>
                  )}
                </div>
                <button onClick={() => toggleDisponivel(op)}
                  className={`text-xs px-2 py-1 rounded-md font-medium whitespace-nowrap ${op.disponivel ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-200 text-stone-500'}`}>
                  {op.disponivel ? 'Disponível' : 'Em falta'}
                </button>
                <button onClick={() => removerOpcao(op)} className="text-stone-400 hover:text-red-600 shrink-0"><Trash2 size={14} /></button>
              </div>
            ))}
            {opcoes.length === 0 && <p className="text-sm text-stone-400">Nenhuma opção cadastrada ainda.</p>}
          </div>
        )}

        {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}

        <div className="border-t border-stone-200 pt-4 space-y-2">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Nova opção</p>
          <div className="flex gap-2">
            <input value={novo.nome} onChange={e => setNovo({...novo, nome: e.target.value})}
              placeholder="Ex: Laranja" className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900" />
            <input type="number" value={novo.preco_adicional} onChange={e => setNovo({...novo, preco_adicional: e.target.value})}
              placeholder="+R$" className="w-20 border border-stone-300 rounded-lg px-2 py-2 text-sm text-stone-900" />
          </div>
          <button onClick={addOpcao} disabled={saving} className="w-full bg-stone-900 text-white text-sm py-2 rounded-lg font-medium flex items-center justify-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : 'Adicionar opção'}
          </button>
        </div>

        <button onClick={onClose} className="w-full mt-4 py-2.5 rounded-lg border border-stone-300 text-stone-700 font-medium">Fechar</button>
      </div>
    </div>
  );
}

function AdminView({ token, onLogout }) {
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
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState('cardapio'); // cardapio | chamados
  const [chamados, setChamados] = useState([]);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const carregar = async () => {
    setLoading(true);
    try {
      const rest = await sbFetch(`restaurantes?slug=eq.${RESTAURANTE_SLUG}&select=id,nome,logo_url,capa_url,endereco,horario_texto,instagram_url,whatsapp_url,hora_abertura,hora_fechamento`);
      const rId = rest[0]?.id;
      setRestauranteId(rId);
      setRestauranteDados(rest[0]);
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

  const carregarChamados = async () => {
    if (!restauranteId) return;
    try {
      const dados = await sbFetch(`chamados?restaurante_id=eq.${restauranteId}&status=eq.pendente&order=criado_em.desc`, { headers: authHeaders });
      setChamados(dados || []);
    } catch (e) { /* silencioso, tenta de novo no próximo ciclo */ }
  };

  const atenderChamado = async (id) => {
    try {
      await sbFetch(`chamados?id=eq.${id}`, {
        method: 'PATCH', headers: authHeaders,
        body: JSON.stringify({ status: 'atendido', atendido_em: new Date().toISOString() }),
      });
      carregarChamados();
    } catch (e) { setErro('Erro ao atualizar chamado: ' + e.message); }
  };

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    if (!restauranteId) return;
    carregarChamados();
    const interval = setInterval(carregarChamados, 5000);
    return () => clearInterval(interval);
  }, [restauranteId]);

  const save = async (item) => {
    try {
      const rest = await sbFetch(`restaurantes?slug=eq.${RESTAURANTE_SLUG}&select=id`);
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
      <div className="bg-stone-900 text-white px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <span className="font-semibold">Painel do restaurante</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowProfile(true)} className="text-xs bg-white/10 px-3 py-1.5 rounded-lg font-medium">Perfil</button>
          <button onClick={() => setShowGroups(true)} className="text-xs bg-white/10 px-3 py-1.5 rounded-lg font-medium">Grupos</button>
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex items-center gap-1.5 bg-white text-stone-900 px-3 py-1.5 rounded-lg text-sm font-medium">
            <Plus size={16} /> Novo prato
          </button>
          <button onClick={onLogout} className="text-stone-300 hover:text-white p-1.5"><LogOut size={18} /></button>
        </div>
      </div>

      {erro && <p className="text-sm text-red-600 bg-red-50 px-5 py-2">{erro}</p>}

      <div className="flex border-b border-stone-200 bg-white sticky top-[60px] z-10">
        <button onClick={() => setAba('cardapio')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${aba === 'cardapio' ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-400'}`}>
          Cardápio
        </button>
        <button onClick={() => setAba('chamados')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors relative ${aba === 'chamados' ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-400'}`}>
          Chamados
          {chamados.length > 0 && (
            <span className="absolute top-1.5 right-[calc(50%-38px)] bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {chamados.length}
            </span>
          )}
        </button>
      </div>

      {aba === 'chamados' && (
        <div className="p-4 max-w-2xl mx-auto space-y-2">
          {chamados.length === 0 && (
            <p className="text-stone-400 text-sm text-center py-10">Nenhum chamado pendente no momento.</p>
          )}
          {chamados.map(c => (
            <div key={c.id} className="flex items-center justify-between bg-white border border-amber-200 bg-amber-50 rounded-xl p-4">
              <div>
                <p className="font-semibold text-stone-900">Mesa {c.mesa}</p>
                <p className="text-xs text-stone-500 mt-0.5">
                  {new Date(c.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button onClick={() => atenderChamado(c.id)}
                className="flex items-center gap-1.5 bg-stone-900 text-white text-sm px-3 py-2 rounded-lg font-medium">
                <Check size={14} /> Atendido
              </button>
            </div>
          ))}
        </div>
      )}

      {aba === 'cardapio' && (
      <div className="p-4 space-y-6 max-w-2xl mx-auto">
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
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex gap-1.5">
                          <button onClick={() => setManagingOptions(item)} className="text-stone-400 hover:text-stone-700 p-1" title="Opções/sabores"><ListPlus size={14} /></button>
                          <button onClick={() => { setEditing(item); setShowForm(true); }} className="text-stone-400 hover:text-stone-700 p-1"><Edit2 size={14} /></button>
                          <button onClick={() => remove(item.id)} className="text-stone-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                        </div>
                        <button onClick={() => toggleDisponivel(item)}
                          className={`text-xs px-2 py-1 rounded-md font-medium whitespace-nowrap ${item.disponivel ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                          {item.disponivel ? 'Disponível' : 'Reativar'}
                        </button>
                      </div>
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
    </div>
  );
}

// ---------- ITEM DETALHE (cliente) ----------

function ItemModal({ item, onClose }) {
  const [opcoes, setOpcoes] = useState([]);
  const [loadingOpcoes, setLoadingOpcoes] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const dados = await sbFetch(`opcoes_produto?prato_id=eq.${item.id}&disponivel=eq.true&order=ordem`);
        setOpcoes(dados || []);
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
            <button onClick={onClose} className="text-stone-400 shrink-0"><X size={20} /></button>
          </div>
          <p className="text-stone-500 text-sm leading-relaxed mt-2">{item.descricao}</p>
          <p className="text-lg font-semibold text-stone-900 mt-4">{formatPreco(item.preco)}</p>

          {!loadingOpcoes && opcoes.length > 0 && (
            <div className="mt-5 pt-4 border-t border-stone-100">
              <div className="flex items-center gap-1.5 mb-3">
                <ListPlus size={14} className="text-stone-900" />
                <p className="text-sm font-bold text-stone-900 uppercase tracking-wide">Opções disponíveis</p>
              </div>
              <div className="space-y-2">
                {opcoes.map(op => (
                  <div key={op.id} className="flex items-center justify-between bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5">
                    <span className="text-sm font-medium text-stone-800">{op.nome}</span>
                    {op.preco_adicional > 0 ? (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                        + {formatPreco(op.preco_adicional)}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-stone-400">sem custo adicional</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- CARDÁPIO (cliente) ----------

function WaiterButton({ restauranteId, mesa }) {
  const [status, setStatus] = useState('idle'); // idle | sending | called
  const [erro, setErro] = useState('');

  const chamar = async () => {
    if (!restauranteId) return;
    setStatus('sending');
    setErro('');
    try {
      await sbFetch('chamados', {
        method: 'POST',
        body: JSON.stringify({ restaurante_id: restauranteId, mesa: mesa || 'Não informada' }),
      });
      setStatus('called');
      setTimeout(() => setStatus('idle'), 30000); // libera de novo depois de 30s
    } catch (e) {
      setErro('Não foi possível chamar. Tente de novo.');
      setStatus('idle');
    }
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      {erro && <p className="text-xs bg-red-600 text-white px-2.5 py-1 rounded-lg shadow">{erro}</p>}
      <button
        onClick={chamar}
        disabled={status !== 'idle'}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
          status === 'called' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-stone-500 border-stone-200'
        }`}>
        {status === 'sending' && <Loader2 size={13} className="animate-spin" />}
        {status === 'called' && <Check size={13} />}
        {status === 'idle' && <Bell size={13} />}
        {status === 'called' ? 'Garçom a caminho' : 'Chamar garçom'}
      </button>
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
  const mesa = new URLSearchParams(window.location.search).get('mesa');

  useEffect(() => {
    (async () => {
      try {
        const rest = await sbFetch(`restaurantes?slug=eq.${RESTAURANTE_SLUG}&select=id,nome,logo_url,capa_url,endereco,horario_texto,instagram_url,whatsapp_url,hora_abertura,hora_fechamento`);
        const rst = rest[0];
        if (!rst) { setErro('Restaurante não encontrado.'); setLoading(false); return; }
        setRestaurante(rst);
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

  const scrollToCategory = (id) => {
    setActiveCat(id);
    const el = document.getElementById(`cat-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      {/* Capa */}
      <div className="relative h-40 bg-stone-800">
        {restaurante?.capa_url && (
          <img src={restaurante.capa_url} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

        {(restaurante?.instagram_url || restaurante?.whatsapp_url) && (
          <div className="absolute top-3 right-3 flex gap-2">
            {restaurante?.instagram_url && (
              <a href={restaurante.instagram_url} target="_blank" rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition-transform">
                <Instagram size={15} className="text-pink-600" />
              </a>
            )}
            {restaurante?.whatsapp_url && (
              <a href={restaurante.whatsapp_url} target="_blank" rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition-transform">
                <MessageCircle size={15} className="text-emerald-600" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Avatar sobreposto + info, centralizados */}
      <div className="px-5 -mt-9 relative flex flex-col items-center text-center">
        <div className="w-[72px] h-[72px] rounded-full border-4 border-stone-50 bg-white overflow-hidden shadow-md">
          {restaurante?.logo_url
            ? <img src={restaurante.logo_url} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center bg-stone-100"><ChefHat size={26} className="text-stone-400" /></div>}
        </div>
        <div className="mt-2.5">
          <h1 className="text-xl font-bold text-stone-900">{restaurante?.nome || 'Restaurante'}</h1>
          {restaurante?.endereco && (
            <p className="text-stone-500 text-sm mt-0.5">{restaurante.endereco}</p>
          )}
          {(() => {
            const status = calcularStatusAbertura(restaurante?.hora_abertura, restaurante?.hora_fechamento);
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
        <div className="mt-3">
          <WaiterButton restauranteId={restaurante?.id} mesa={mesa} />
        </div>
      </div>

      {/* Carrossel de destaques */}
      {pratos.some(p => p.destaque) && (
        <div className="pt-5 pb-1">
          <div className="flex items-center gap-1.5 px-5 mb-2.5">
            <Flame size={15} className="text-orange-500" />
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wide">Destaques da casa</h2>
          </div>
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
        </div>
      )}

      {/* Abas fixas de categoria */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-stone-200 flex gap-1.5 overflow-x-auto z-10 px-3 py-2.5 shadow-sm mt-4">
        {categorias.map(cat => (
          <button key={cat.id} onClick={() => scrollToCategory(cat.id)}
            className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-full transition-all ${
              activeCat === cat.id ? 'bg-stone-900 text-white shadow-md' : 'bg-stone-100 text-stone-500'
            }`}>
            {cat.nome}
          </button>
        ))}
      </div>

      {/* Lista de pratos agrupada por categoria */}
      <div className="px-3 py-5 max-w-3xl mx-auto space-y-7">
        {categorias.map(cat => {
          const itensCat = pratos.filter(p => p.categoria_id === cat.id).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
          if (itensCat.length === 0) return null;
          return (
            <div key={cat.id} id={`cat-${cat.id}`}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-1 h-5 bg-stone-900 rounded-full" />
                <h2 className="text-lg font-bold text-stone-900">{cat.nome}</h2>
              </div>
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

      {/* Rodapé fixo */}
      <div className="fixed bottom-0 left-0 right-0 bg-stone-900 text-white flex items-center justify-around py-3.5 text-xs font-medium shadow-[0_-4px_12px_rgba(0,0,0,0.15)]">
        <div className="opacity-90">
          <ChefHat size={18} />
        </div>
        <button onClick={onAdmin} className="flex flex-col items-center gap-0.5 opacity-90 hover:opacity-100 transition-opacity">
          <Search size={17} />
          <span>Painel</span>
        </button>
      </div>

      {selected && <ItemModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ---------- APP ----------

export default function App() {
  const [view, setView] = useState('client'); // client | login | admin
  const [token, setToken] = useState(null);

  if (view === 'admin' && token) {
    return <AdminView token={token} onLogout={() => { setToken(null); setView('client'); }} />;
  }
  if (view === 'login') {
    return <LoginScreen onLogin={(tok) => { setToken(tok); setView('admin'); }} onBack={() => setView('client')} />;
  }
  return <ClientView onAdmin={() => setView('login')} />;
}
