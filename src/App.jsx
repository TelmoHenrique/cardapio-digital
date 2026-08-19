import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, ChefHat, ArrowLeft, Flame, Image as ImageIcon, Search, LogOut, Loader2 } from 'lucide-react';

const SUPABASE_URL = 'https://xzipsbuwsjyzgsfasygc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6aXBzYnV3c2p5emdzZmFzeWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNDc0NTYsImV4cCI6MjEwMjcyMzQ1Nn0.6k5ocACvG-ihQyPhmdquEriavxK7Un6E3LSECz8J5GA';
const RESTAURANTE_SLUG = 'restaurante-raiz';

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

function ItemForm({ item, categorias, onSave, onCancel }) {
  const [form, setForm] = useState(item || { categoria_id: categorias[0]?.id || '', nome: '', preco: '', descricao: '', disponivel: true, destaque: false, foto_url: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ ...form, preco: parseFloat(form.preco) || 0 });
    setSaving(false);
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
            <label className="text-sm text-stone-600 mb-1 block">Foto (URL)</label>
            <div className="flex gap-3 items-start">
              <div className="w-20 h-20 rounded-lg bg-stone-100 overflow-hidden shrink-0 flex items-center justify-center border border-stone-200">
                {form.foto_url ? <img src={form.foto_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-stone-300" />}
              </div>
              <input value={form.foto_url || ''} onChange={e => setForm({...form, foto_url: e.target.value})}
                className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900" placeholder="Cole o link da foto" />
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
              className="w-full border
