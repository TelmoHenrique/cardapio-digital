import React, { useState, useEffect, useRef } from 'react';
import {
  Smartphone, QrCode, MessageCircle, Truck, Clock, BarChart3, BellRing, MapPin, Zap, Check,
  ChevronDown, ArrowRight, ArrowDown, Flame, ShoppingBag, Users, Percent, Camera, Plus, Minus, Sparkles, Store,
} from 'lucide-react';

// =====================================================================
//  PÁGINA DE APRESENTAÇÃO — menupapa.com.br
//  Para trocar textos, números e preços, edite só este bloco de cima.
// =====================================================================
const MARCA_NOME = 'MENU PAPA';
const MARCA_LOGO_URL = 'https://i.imgur.com/Rn2P8qP.jpeg';
const WHATSAPP_CONTATO = '5565992647429'; // 55 + DDD + número
const DEMO_SLUG = 'espeto-cuiaba';   // restaurante que aparece na demonstração ao vivo
const PRECO_CARDAPIO = null;          // ex: 'R$ 49,90'  (null = mostra "Consulte valores")
const PRECO_PEDIDOS = null;           // ex: 'R$ 89,90'

const MENSAGEM_WHATSAPP = 'Olá! Vi o site do MENU PAPA e quero saber mais sobre o cardápio digital para o meu restaurante.';
const linkContato = WHATSAPP_CONTATO
  ? `https://wa.me/${WHATSAPP_CONTATO}?text=${encodeURIComponent(MENSAGEM_WHATSAPP)}`
  : '#demo';

const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const CSS = `
.mp-land { --bg:#120e0a; --bg2:#1a140f; --card:#1f1812; --line:rgba(255,255,255,.08); --txt:#f6efe7; --mut:#b9ab9b; --or:#f97316; --am:#fbbf24;
  background:var(--bg); color:var(--txt); font-family:'DM Sans','Inter',system-ui,sans-serif; overflow-x:hidden; }
.mp-land h1,.mp-land h2,.mp-land h3,.mp-display { font-family:'Bricolage Grotesque','DM Sans',system-ui,sans-serif; letter-spacing:-.02em; }
.mp-glow { background: radial-gradient(60% 50% at 50% 0%, rgba(249,115,22,.28), transparent 70%), radial-gradient(40% 40% at 90% 30%, rgba(251,191,36,.10), transparent 70%); }
.mp-grain { background-image: radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px); background-size: 22px 22px; }
.mp-grad-txt { background: linear-gradient(100deg,#fb923c,#fbbf24 60%,#fde68a); -webkit-background-clip:text; background-clip:text; color:transparent; }
.mp-reveal { opacity:0; transform: translateY(26px); transition: opacity .7s ease, transform .7s cubic-bezier(.2,.7,.2,1); }
.mp-reveal.in { opacity:1; transform:none; }
.mp-btn { display:inline-flex; align-items:center; justify-content:center; gap:.5rem; min-height:52px; padding:0 1.5rem; border-radius:999px; font-weight:700; transition: transform .15s ease, box-shadow .2s ease; }
.mp-btn:active { transform: scale(.97); }
.mp-btn-main { background:linear-gradient(135deg,#f97316,#ea580c); color:#fff; box-shadow:0 10px 30px -8px rgba(249,115,22,.7); }
.mp-btn-main:hover { box-shadow:0 14px 38px -6px rgba(249,115,22,.9); transform: translateY(-2px); }
.mp-btn-ghost { border:1px solid rgba(255,255,255,.18); color:var(--txt); background:rgba(255,255,255,.04); }
.mp-btn-ghost:hover { background:rgba(255,255,255,.09); }
.mp-card { background:var(--card); border:1px solid var(--line); border-radius:22px; }
.mp-float { animation: mpfloat 6s ease-in-out infinite; }
@keyframes mpfloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-12px) } }
@keyframes mppulse { 0% { box-shadow:0 0 0 0 rgba(249,115,22,.7) } 100% { box-shadow:0 0 0 14px rgba(249,115,22,0) } }
.mp-pulse { animation: mppulse 1.4s ease-out infinite; }
@keyframes mpping { 0%{ transform:scale(1) } 50%{ transform:scale(1.25) } 100%{ transform:scale(1) } }
@keyframes mpmarq { from { transform: translateX(0) } to { transform: translateX(-50%) } }
.mp-marq { animation: mpmarq 28s linear infinite; width:max-content; }
@keyframes mpbounce { 0%,100% { transform: translateY(0) } 50% { transform: translateY(14px) } }
@keyframes mpbouncex { 0%,100% { transform: translateX(0) } 50% { transform: translateX(14px) } }
@keyframes mpring { 0% { box-shadow:0 0 0 0 rgba(249,115,22,.55), 0 40px 90px -20px rgba(0,0,0,.9) } 100% { box-shadow:0 0 0 22px rgba(249,115,22,0), 0 40px 90px -20px rgba(0,0,0,.9) } }
.mp-bounce { animation: mpbounce 1s ease-in-out infinite; }
.mp-bouncex { animation: mpbouncex 1s ease-in-out infinite; }
.mp-ring { animation: mpring 1.8s ease-out infinite; }
@keyframes mpslide { from { transform: translateY(120%); opacity:0 } to { transform:none; opacity:1 } }
.mp-slide { animation: mpslide .5s cubic-bezier(.2,.8,.2,1) both; }
@keyframes mppop { 0%{ transform:scale(.6); opacity:0 } 70%{ transform:scale(1.06) } 100%{ transform:scale(1); opacity:1 } }
.mp-pop { animation: mppop .45s ease-out both; }
.mp-scene { position:absolute; inset:0; transition: opacity .5s ease, transform .5s ease; }
.mp-range { -webkit-appearance:none; appearance:none; width:100%; height:6px; border-radius:99px; background:rgba(255,255,255,.14); outline:none; }
.mp-range::-webkit-slider-thumb { -webkit-appearance:none; width:26px; height:26px; border-radius:50%; background:#f97316; border:4px solid #fff; box-shadow:0 2px 10px rgba(0,0,0,.5); cursor:pointer; }
.mp-range::-moz-range-thumb { width:22px; height:22px; border-radius:50%; background:#f97316; border:4px solid #fff; cursor:pointer; }
@media (prefers-reduced-motion: reduce) { .mp-float,.mp-pulse,.mp-marq,.mp-slide,.mp-pop,.mp-bounce,.mp-bouncex,.mp-ring { animation:none !important } .mp-reveal { opacity:1; transform:none; transition:none } }
`;

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.mp-reveal');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  }, []);
}

function Reveal({ children, className = '', delay = 0 }) {
  return <div className={`mp-reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

// ------------------------- Celular animado do topo -------------------------
function PhoneAnimado() {
  const [cena, setCena] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setCena(c => (c + 1) % 4), 3400);
    return () => clearInterval(t);
  }, []);
  const vis = (n) => ({ opacity: cena === n ? 1 : 0, transform: cena === n ? 'none' : 'scale(.96)', pointerEvents: 'none' });
  const itens = [
    { n: 'Combo da Casa', p: 'R$ 32,00', c: 'from-orange-500 to-red-600' },
    { n: 'Porção grande', p: 'R$ 28,00', c: 'from-amber-400 to-orange-500' },
    { n: 'Bebida gelada', p: 'R$ 8,00', c: 'from-sky-400 to-blue-600' },
  ];
  return (
    <div className="relative mx-auto" style={{ width: 290, height: 590 }}>
      <div className="absolute -inset-10 rounded-full bg-orange-500/20 blur-3xl" />
      <div className="relative w-full h-full rounded-[3rem] bg-black p-[10px] shadow-[0_40px_90px_-20px_rgba(0,0,0,.9)] ring-1 ring-white/15">
        <div className="relative w-full h-full rounded-[2.4rem] overflow-hidden bg-stone-50 text-stone-900">
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-30" />

          {/* cena 0 e 1: cardápio */}
          <div className="mp-scene" style={{ opacity: cena <= 1 ? 1 : 0, transform: cena <= 1 ? 'none' : 'scale(.96)' }}>
            <div className="h-28 bg-gradient-to-br from-orange-500 via-orange-600 to-amber-700 relative">
              <div className="absolute bottom-0 inset-x-0 h-5 bg-stone-50 rounded-t-3xl border-t-[3px] border-orange-500" />
            </div>
            <div className="-mt-9 relative z-10 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-white ring-4 ring-white shadow flex items-center justify-center"><Store size={26} className="text-orange-600" /></div>
              <p className="font-bold mt-1.5 text-[15px]">Seu Restaurante</p>
              <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Aberto agora</p>
            </div>
            <div className="px-3 mt-3 space-y-2">
              {itens.map((it, i) => (
                <div key={it.n} className="bg-white border border-stone-200 rounded-2xl p-2 flex items-center gap-2 shadow-sm">
                  <div className="flex-1 min-w-0 pl-1"><p className="text-[12.5px] font-semibold leading-tight">{it.n}</p><p className="text-emerald-600 text-[12px] font-bold">{it.p}</p></div>
                  <div className={`relative w-14 h-14 rounded-xl bg-gradient-to-br ${it.c} flex items-center justify-center`}>
                    <Flame size={18} className="text-white/90" />
                    {i === 0 && (cena === 1
                      ? <div className="absolute -bottom-1.5 -right-1.5 h-7 rounded-full bg-orange-500 text-white flex items-center shadow-lg text-[11px] font-bold px-1"><Minus size={11} /><span className="px-1.5">2</span><Plus size={11} /></div>
                      : <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-lg mp-pulse"><Plus size={14} /></div>)}
                    {i !== 0 && <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center shadow"><Plus size={14} /></div>}
                  </div>
                </div>
              ))}
            </div>
            {cena === 1 && (
              <div className="mp-slide absolute left-3 right-3 bottom-4 bg-stone-900 text-white rounded-2xl px-4 py-3 flex items-center justify-between text-[12px] font-semibold shadow-xl">
                <span className="flex items-center gap-1.5"><ShoppingBag size={14} /> Ver pedido · 2 itens</span><span>R$ 64,00</span>
              </div>
            )}
          </div>

          {/* cena 2: finalizar */}
          <div className="mp-scene bg-white p-4 pt-10" style={vis(2)}>
            <p className="font-bold text-[15px] mb-3">Finalizar pedido</p>
            <div className="space-y-2.5 text-[12px]">
              <div className="border border-stone-300 rounded-xl px-3 py-2.5 text-stone-500">(65) 99999-0000 <Check size={13} className="inline text-emerald-600 float-right mt-0.5" /></div>
              <div className="border border-stone-300 rounded-xl px-3 py-2.5 text-stone-500">Maria Souza</div>
              <div className="border border-stone-300 rounded-xl px-3 py-2.5 text-stone-500">CEP 78000-000 <Check size={13} className="inline text-emerald-600 float-right mt-0.5" /></div>
              <div className="bg-emerald-50 text-emerald-700 rounded-xl px-3 py-2 font-semibold flex justify-between"><span>Taxa de entrega</span><span>R$ 5,00</span></div>
              <div className="flex justify-between font-bold text-[14px] pt-1"><span>Total</span><span>R$ 69,00</span></div>
            </div>
            <div className="absolute left-4 right-4 bottom-5 bg-emerald-500 text-white rounded-2xl py-3.5 flex items-center justify-center gap-2 text-[12.5px] font-bold mp-pulse">
              <MessageCircle size={16} /> Enviar pedido no WhatsApp
            </div>
          </div>

          {/* cena 3: chega no WhatsApp */}
          <div className="mp-scene bg-[#e5ddd5]" style={vis(3)}>
            <div className="bg-[#075e54] text-white pt-9 pb-2.5 px-4 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"><Store size={15} /></div>
              <div><p className="text-[13px] font-semibold leading-none">Seu Restaurante</p><p className="text-[10px] opacity-80 mt-1">online</p></div>
            </div>
            <div className="p-3">
              <div className={cena === 3 ? 'mp-pop' : ''} >
                <div className="bg-[#dcf8c6] rounded-xl rounded-tr-sm p-3 text-[11px] leading-snug text-stone-800 shadow ml-6 whitespace-pre-line">
                  <b>NOVO PEDIDO</b>{'\n'}Cliente: Maria Souza{'\n'}Tel: (65) 99999-0000{'\n'}Entrega: Rua das Flores, 120{'\n'}----------------{'\n'}2x Combo da Casa  R$ 64,00{'\n'}Taxa de entrega  R$ 5,00{'\n'}<b>Total: R$ 69,00</b>{'\n'}Pagamento: Pix
                </div>
              </div>
              <div className="mt-3 mx-auto w-fit bg-white/90 rounded-full px-3 py-1.5 text-[10.5px] font-semibold text-stone-600 shadow">Pedido pronto. Sem digitar nada.</div>
            </div>
          </div>
        </div>
      </div>

      {/* selos flutuantes */}
      <div className="absolute -left-6 sm:-left-14 top-24 mp-float bg-white text-stone-900 rounded-2xl px-3.5 py-2.5 shadow-2xl text-[12px] font-bold flex items-center gap-2" style={{ animationDelay: '.4s' }}>
        <span className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center"><Percent size={14} /></span> 0% de comissão
      </div>
      <div className="absolute -right-5 sm:-right-12 bottom-28 mp-float bg-white text-stone-900 rounded-2xl px-3.5 py-2.5 shadow-2xl text-[12px] font-bold flex items-center gap-2" style={{ animationDelay: '1.6s' }}>
        <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><Zap size={14} /></span> Pedido em segundos
      </div>
    </div>
  );
}

// ------------------------- Calculadora de comissão -------------------------
function Calculadora() {
  const [pedidos, setPedidos] = useState(400);
  const [ticket, setTicket] = useState(55);
  const [taxa, setTaxa] = useState(25);
  const fat = pedidos * ticket;
  const mensal = fat * taxa / 100;
  const Slider = ({ label, valor, set, min, max, step, fmt }) => (
    <div>
      <div className="flex justify-between items-baseline mb-3"><span className="text-[15px] text-[color:var(--mut)]">{label}</span><span className="mp-display text-2xl font-bold">{fmt(valor)}</span></div>
      <input type="range" className="mp-range" min={min} max={max} step={step} value={valor} onChange={e => set(Number(e.target.value))} />
    </div>
  );
  return (
    <div className="mp-card p-6 sm:p-9 grid lg:grid-cols-2 gap-10 items-center">
      <div className="space-y-8">
        <Slider label="Pedidos de delivery por mês" valor={pedidos} set={setPedidos} min={50} max={2000} step={10} fmt={v => v} />
        <Slider label="Ticket médio" valor={ticket} set={setTicket} min={20} max={200} step={5} fmt={v => brl(v)} />
        <Slider label="Comissão cobrada pelo app" valor={taxa} set={setTaxa} min={10} max={35} step={1} fmt={v => v + '%'} />
        <p className="text-xs text-[color:var(--mut)]">Simulação com os valores que você ajustar. A comissão real varia conforme o aplicativo e o plano contratado.</p>
      </div>
      <div className="text-center rounded-3xl p-7 bg-gradient-to-br from-orange-500/15 to-red-500/10 border border-orange-500/25">
        <p className="text-sm uppercase tracking-widest text-orange-300 font-semibold">Você entrega por mês</p>
        <p className="mp-display text-5xl sm:text-6xl font-extrabold mp-grad-txt my-2">{brl(mensal)}</p>
        <p className="text-[color:var(--mut)]">só em comissão. Por ano, são <b className="text-white">{brl(mensal * 12)}</b>.</p>
        <div className="my-6 h-px bg-white/10" />
        <p className="text-sm text-[color:var(--mut)]">Com o MENU PAPA, o pedido vai direto para o seu WhatsApp:</p>
        <p className="mp-display text-3xl font-extrabold text-emerald-400 mt-1">R$ 0 de comissão por pedido</p>
        <p className="text-xs text-[color:var(--mut)] mt-2">Você paga só a mensalidade do sistema.</p>
      </div>
    </div>
  );
}

function Faq({ q, a }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="mp-card overflow-hidden">
      <button onClick={() => setAberto(!aberto)} className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 min-h-[56px]">
        <span className="font-semibold">{q}</span>
        <ChevronDown size={20} className="shrink-0 text-orange-400 transition-transform" style={{ transform: aberto ? 'rotate(180deg)' : 'none' }} />
      </button>
      {aberto && <p className="px-5 pb-5 text-[color:var(--mut)] leading-relaxed -mt-1">{a}</p>}
    </div>
  );
}

export default function Landing() {
  useReveal();
  useEffect(() => {
    document.title = 'MENU PAPA — Cardápio digital com pedidos no WhatsApp';
    const fontes = document.createElement('link');
    fontes.rel = 'stylesheet';
    fontes.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=DM+Sans:wght@400;500;700&display=swap';
    document.head.appendChild(fontes);
    return () => { document.head.removeChild(fontes); };
  }, []);

  const Cta = ({ children, className = '', ghost }) => (
    <a href={linkContato} target={WHATSAPP_CONTATO ? '_blank' : undefined} rel="noopener noreferrer"
      className={`mp-btn ${ghost ? 'mp-btn-ghost' : 'mp-btn-main'} ${className}`}>{children}</a>
  );

  const marquee = ['Cardápio com fotos', 'Pedido direto no WhatsApp', 'Sem comissão por pedido', 'Sem app para baixar', 'QR Code na mesa', 'Entrega por bairro', 'Você edita pelo celular', 'Aberto e fechado automático'];

  const recursos = [
    { i: Camera, t: 'Cardápio que dá fome', d: 'Fotos grandes, grupos, destaques da casa e descrição de cada prato. Seu cliente escolhe com os olhos.' },
    { i: ShoppingBag, t: 'Carrinho e pedido pronto', d: 'O cliente monta o pedido, escolhe sabores e adicionais, e ele chega organizado no seu WhatsApp.' },
    { i: MapPin, t: 'Entrega calculada sozinha', d: 'O cliente digita o CEP e a taxa do bairro aparece na hora. Fora da sua área? O sistema avisa.' },
    { i: Clock, t: 'Aberto e fechado automático', d: 'Defina os horários de cada dia. Fechou, o pedido para. Sem cliente chamando fora de hora.' },
    { i: BellRing, t: 'Cliente acompanha o pedido', d: 'Em preparo, pronto, saiu para entrega. Você avisa com um toque e o cliente acompanha pelo cardápio.' },
    { i: Users, t: 'Cliente cadastrado pelo telefone', d: 'Na segunda compra, nome e endereço já aparecem preenchidos. Pedir fica rápido demais.' },
    { i: QrCode, t: 'QR Code para as mesas', d: 'Um QR Code por mesa, sem cardápio de papel e sem impressão toda vez que o preço mudar.' },
    { i: BarChart3, t: 'Relatório de pedidos', d: 'Quantos pedidos, quanto vendeu, por período. Cancelou? Marca no painel e o total se ajusta.' },
    { i: Smartphone, t: 'Tudo pelo celular', d: 'Trocou o preço, pausou um prato, subiu uma foto nova. O cardápio muda na hora, do bolso.' },
  ];

  return (
    <div className="mp-land min-h-screen">
      <style>{CSS}</style>

      {/* topo */}
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-[#120e0a]/70 border-b border-white/5" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <a href="#topo" className="flex items-center gap-2.5">
            <img src={MARCA_LOGO_URL} alt="" className="w-9 h-9 rounded-full object-cover" />
            <span className="mp-display font-extrabold tracking-tight text-lg">{MARCA_NOME}</span>
          </a>
          <nav className="hidden md:flex items-center gap-7 text-sm text-[color:var(--mut)]">
            <a href="#demo" className="hover:text-white">Demonstração</a>
            <a href="#recursos" className="hover:text-white">Recursos</a>
            <a href="#planos" className="hover:text-white">Planos</a>
            <a href="#duvidas" className="hover:text-white">Dúvidas</a>
          </nav>
          <Cta className="!min-h-[42px] !px-5 text-sm">Quero o meu</Cta>
        </div>
      </header>

      {/* HERO */}
      <section id="topo" className="relative pt-28 pb-16 sm:pt-36 mp-glow">
        <div className="absolute inset-0 mp-grain opacity-60 pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-5 grid lg:grid-cols-[1.1fr_.9fr] gap-14 items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[.18em] uppercase text-orange-300 border border-orange-400/30 bg-orange-500/10 rounded-full px-4 py-2">
              <Sparkles size={13} /> Cardápio digital + pedidos no WhatsApp
            </span>
            <h1 className="mt-6 text-[2.6rem] leading-[1.02] sm:text-6xl lg:text-7xl font-extrabold">
              E se o seu cardápio <span className="mp-grad-txt">vendesse por você?</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-[color:var(--mut)] max-w-xl leading-relaxed">
              Transforme o seu cardápio em um link com fotos, preços e carrinho. O pedido chega pronto no seu WhatsApp, sem app, sem comissão por pedido e sem papel.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <a href="#demo" className="mp-btn mp-btn-main">Ver funcionando agora <ArrowRight size={18} /></a>
              <Cta ghost><MessageCircle size={18} /> Quero para o meu restaurante</Cta>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[color:var(--mut)]">
              {['0% de comissão por pedido', 'Sem app para baixar', 'Você edita pelo celular'].map(t => (
                <span key={t} className="flex items-center gap-2"><Check size={16} className="text-emerald-400" /> {t}</span>
              ))}
            </div>
          </div>
          <div className="pt-6 lg:pt-0"><PhoneAnimado /></div>
        </div>
      </section>

      {/* faixa */}
      <div className="border-y border-white/10 bg-black/30 py-4 overflow-hidden">
        <div className="mp-marq flex gap-12 text-sm font-semibold text-[color:var(--mut)] uppercase tracking-widest">
          {[...marquee, ...marquee].map((t, i) => <span key={i} className="flex items-center gap-12 whitespace-nowrap">{t}<span className="text-orange-500">•</span></span>)}
        </div>
      </div>

      {/* PROBLEMA */}
      <section className="max-w-6xl mx-auto px-5 py-24">
        <Reveal><h2 className="text-4xl sm:text-5xl font-extrabold max-w-3xl leading-[1.05]">Três coisas que acontecem hoje no seu restaurante <span className="text-orange-400">e você nem percebe.</span></h2></Reveal>
        <div className="mt-12 grid md:grid-cols-3 gap-5">
          {[
            ['O cardápio de papel mente.', 'Preço mudou, prato acabou, e o papel continua dizendo outra coisa. O cliente pede o que não tem e a conversa azeda.'],
            ['O WhatsApp vira interrogatório.', '"Tem foto?", "Quanto é a entrega?", "Até que horas abre?". Você responde as mesmas 20 perguntas todo dia, em vez de vender.'],
            ['O pedido se perde na correria.', 'Anotado no verso de uma nota, com endereço pela metade. Um erro na entrega e o cliente não volta.'],
          ].map(([t, d], i) => (
            <Reveal key={t} delay={i * 120}>
              <div className="mp-card p-7 h-full">
                <span className="mp-display text-5xl font-extrabold text-orange-500/40">0{i + 1}</span>
                <h3 className="text-xl font-bold mt-3">{t}</h3>
                <p className="mt-3 text-[color:var(--mut)] leading-relaxed">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal><p className="mt-12 text-2xl sm:text-3xl font-bold max-w-3xl">O MENU PAPA resolve as três, <span className="mp-grad-txt">com um único link.</span></p></Reveal>
      </section>

      {/* CALCULADORA */}
      <section className="bg-[color:var(--bg2)] border-y border-white/5 py-24">
        <div className="max-w-6xl mx-auto px-5">
          <Reveal>
            <p className="text-orange-400 font-bold uppercase tracking-widest text-sm">Faça a conta</p>
            <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold max-w-3xl leading-[1.05]">Quanto você deixa todo mês nos apps de delivery?</h2>
            <p className="mt-4 text-[color:var(--mut)] max-w-2xl text-lg">Mexa nos controles com os números do seu restaurante. Pode doer um pouco.</p>
          </Reveal>
          <Reveal className="mt-10"><Calculadora /></Reveal>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="max-w-6xl mx-auto px-5 py-24">
        <Reveal><h2 className="text-4xl sm:text-5xl font-extrabold">No ar sem dor de cabeça.</h2></Reveal>
        <div className="mt-12 grid md:grid-cols-3 gap-5">
          {[
            ['Você manda o cardápio', 'Fotos, pratos e preços do jeito que você já tem. Pode ser foto do papel, a gente organiza.'],
            ['A gente publica o seu link', 'Seu restaurante ganha um endereço próprio e um QR Code pronto para colar na mesa, no balcão e no Instagram.'],
            ['O pedido cai no seu WhatsApp', 'O cliente escolhe, o sistema calcula a entrega e o pedido chega organizado. É só preparar.'],
          ].map(([t, d], i) => (
            <Reveal key={t} delay={i * 120}>
              <div className="relative mp-card p-7 h-full">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mp-display text-xl font-extrabold shadow-lg shadow-orange-900/40">{i + 1}</div>
                <h3 className="text-xl font-bold mt-5">{t}</h3>
                <p className="mt-3 text-[color:var(--mut)] leading-relaxed">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* DEMO AO VIVO */}
      <section id="demo" className="relative py-24 mp-glow border-y border-white/5">
        <div className="max-w-6xl mx-auto px-5 grid lg:grid-cols-2 gap-14 items-center">
          <Reveal>
            <p className="text-orange-400 font-bold uppercase tracking-widest text-sm">Demonstração ao vivo</p>
            <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold leading-[1.05]">Não é imagem. <span className="mp-grad-txt">É um cardápio de verdade.</span></h2>
            <p className="mt-5 text-lg text-[color:var(--mut)] leading-relaxed max-w-lg">Role, toque nos pratos, adicione ao carrinho e veja o pedido se montar. É exatamente o que o seu cliente vai ver no celular.</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a href={`/${DEMO_SLUG}`} target="_blank" rel="noopener noreferrer" className="mp-btn mp-btn-ghost">Abrir em tela cheia <ArrowRight size={18} /></a>
              <Cta><MessageCircle size={18} /> Quero um assim</Cta>
            </div>
            {/* chamada para testar a demonstração */}
            <div className="mt-8 flex flex-col lg:flex-row items-center lg:items-center gap-3 text-center lg:text-left">
              <div className="rounded-2xl border border-orange-400/60 bg-orange-500/15 px-5 py-3.5 mp-pulse">
                <p className="mp-display text-xl font-extrabold text-orange-300">Faça o teste agora!</p>
                <p className="text-sm text-[color:var(--mut)] mt-0.5">Toque no celular, escolha um prato e adicione ao carrinho.</p>
              </div>
              <ArrowDown size={44} strokeWidth={2.75} className="text-orange-400 mp-bounce lg:hidden" />
              <ArrowRight size={44} strokeWidth={2.75} className="text-orange-400 mp-bouncex hidden lg:block" />
            </div>
          </Reveal>
          <Reveal className="flex justify-center">
            <div className="relative" style={{ width: 320, height: 650 }}>
              <div className="absolute -inset-8 rounded-full bg-orange-500/15 blur-3xl" />
              <div className="relative w-full h-full rounded-[3rem] bg-black p-[10px] ring-1 ring-white/15 mp-ring">
                {/* a demonstração roda num celular de 390px e é reduzida para caber na moldura (letras e fotos ficam menores, como num celular de verdade) */}
                <div className="w-full h-full rounded-[2.4rem] overflow-hidden bg-white relative">
                  <iframe title="Demonstração do MENU PAPA" src={`/${DEMO_SLUG}`} loading="lazy"
                    className="border-0 bg-white absolute top-0 left-0"
                    style={{ width: 390, height: 819, transform: 'scale(0.769)', transformOrigin: 'top left' }} />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* RECURSOS */}
      <section id="recursos" className="max-w-6xl mx-auto px-5 py-24">
        <Reveal>
          <p className="text-orange-400 font-bold uppercase tracking-widest text-sm">Tudo incluído</p>
          <h2 className="mt-3 text-4xl sm:text-5xl font-extrabold max-w-3xl leading-[1.05]">Feito para restaurante pequeno que quer vender mais.</h2>
        </Reveal>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {recursos.map(({ i: Icone, t, d }, k) => (
            <Reveal key={t} delay={(k % 3) * 100}>
              <div className="mp-card p-6 h-full hover:border-orange-500/40 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/15 text-orange-400 flex items-center justify-center"><Icone size={22} /></div>
                <h3 className="text-lg font-bold mt-4">{t}</h3>
                <p className="mt-2 text-[color:var(--mut)] leading-relaxed text-[15px]">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="bg-[color:var(--bg2)] border-y border-white/5 py-24">
        <div className="max-w-5xl mx-auto px-5">
          <Reveal className="text-center">
            <h2 className="text-4xl sm:text-5xl font-extrabold">Dois jeitos de começar.</h2>
            <p className="mt-4 text-[color:var(--mut)] text-lg">Mensalidade simples. Sem comissão sobre as suas vendas.</p>
          </Reveal>
          <div className="mt-12 grid md:grid-cols-2 gap-6">
            {[
              { nome: 'Cardápio Digital', preco: PRECO_CARDAPIO, sub: 'Para mostrar o seu cardápio do jeito certo.', itens: ['Link próprio do seu restaurante', 'QR Code para mesas e balcão', 'Fotos, grupos e destaques da casa', 'Aberto e fechado automático', 'Perfil da loja: horários, endereço e redes sociais', 'Painel de edição pelo celular'] },
              { nome: 'Cardápio + Pedidos', preco: PRECO_PEDIDOS, sub: 'Para o cardápio vender sozinho.', destaque: true, itens: ['Tudo do Cardápio Digital', 'Carrinho e pedido direto no seu WhatsApp', 'Entrega por bairro, calculada pelo CEP', 'Cliente cadastrado pelo telefone', 'Acompanhamento do pedido pelo cliente', 'Relatório de pedidos por período'] },
            ].map((p, i) => (
              <Reveal key={p.nome} delay={i * 120}>
                <div className={`relative h-full rounded-[26px] p-7 sm:p-8 ${p.destaque ? 'bg-gradient-to-b from-orange-500/20 to-[color:var(--card)] border-2 border-orange-500/70 shadow-[0_30px_80px_-30px_rgba(249,115,22,.6)]' : 'mp-card'}`}>
                  {p.destaque && <span className="absolute -top-3.5 left-7 bg-gradient-to-r from-orange-500 to-amber-400 text-black text-xs font-extrabold uppercase tracking-wider px-4 py-1.5 rounded-full">Mais escolhido</span>}
                  <h3 className="text-2xl font-extrabold">{p.nome}</h3>
                  <p className="text-[color:var(--mut)] mt-1">{p.sub}</p>
                  <p className="mp-display text-4xl font-extrabold mt-5">{p.preco ? <>{p.preco}<span className="text-base font-medium text-[color:var(--mut)]"> /mês</span></> : <span className="text-3xl">Consulte valores</span>}</p>
                  <ul className="mt-6 space-y-3">
                    {p.itens.map(it => <li key={it} className="flex items-start gap-3 text-[15px]"><Check size={18} className="text-emerald-400 shrink-0 mt-0.5" /> {it}</li>)}
                  </ul>
                  <Cta ghost={!p.destaque} className="w-full mt-8">{p.destaque ? 'Quero esse plano' : 'Quero saber mais'}</Cta>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="duvidas" className="max-w-3xl mx-auto px-5 py-24">
        <Reveal><h2 className="text-4xl sm:text-5xl font-extrabold text-center">Perguntas que todo mundo faz.</h2></Reveal>
        <div className="mt-10 space-y-3">
          {[
            ['Meu cliente precisa baixar algum aplicativo?', 'Não. O cardápio abre direto no navegador do celular, por um link ou QR Code. Nada para instalar.'],
            ['Existe comissão sobre os meus pedidos?', 'Não. O pedido vai direto para o seu WhatsApp, sem intermediário. Você paga apenas a mensalidade do sistema.'],
            ['Eu mesmo consigo mudar preços e fotos?', 'Sim, pelo celular. Você troca preço, pausa um prato que acabou e sobe foto nova, e o cardápio muda na hora.'],
            ['Preciso entender de tecnologia?', 'Não. O painel foi pensado para quem usa só o celular. E a gente ajuda a montar o primeiro cardápio.'],
            ['Funciona com o meu WhatsApp de sempre?', 'Sim. O pedido chega no número que você já usa, como uma mensagem pronta. Você só confere e prepara.'],
            ['Posso ver antes de decidir?', 'Pode. A demonstração aqui na página é um cardápio real. Teste à vontade e chame a gente se quiser ver com o seu cardápio.'],
          ].map(([q, a]) => <Reveal key={q}><Faq q={q} a={a} /></Reveal>)}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="px-5 pb-24">
        <Reveal>
          <div className="relative max-w-5xl mx-auto rounded-[32px] overflow-hidden text-center px-6 py-16 sm:py-20 bg-gradient-to-br from-orange-500 via-orange-600 to-red-700">
            <div className="absolute inset-0 mp-grain opacity-40" />
            <div className="relative">
              <h2 className="text-4xl sm:text-6xl font-extrabold leading-[1.02] text-white max-w-3xl mx-auto">O seu próximo cliente já está com o celular na mão.</h2>
              <p className="mt-5 text-orange-50 text-lg max-w-xl mx-auto">Coloque o seu cardápio na frente dele e deixe o pedido chegar sozinho.</p>
              <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
                <a href={linkContato} target={WHATSAPP_CONTATO ? '_blank' : undefined} rel="noopener noreferrer"
                  className="mp-btn bg-white text-orange-700 shadow-2xl hover:-translate-y-0.5"><MessageCircle size={18} /> Falar no WhatsApp</a>
                <a href="#demo" className="mp-btn border border-white/50 text-white hover:bg-white/10">Ver a demonstração</a>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-white/10 py-10 px-5" style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[color:var(--mut)]">
          <span className="flex items-center gap-2.5"><img src={MARCA_LOGO_URL} alt="" className="w-7 h-7 rounded-full object-cover" /><b className="text-white mp-display">{MARCA_NOME}</b> · Cardápio digital para restaurantes</span>
          <span>© {new Date().getFullYear()} {MARCA_NOME}. Todos os direitos reservados.</span>
        </div>
      </footer>
    </div>
  );
}
