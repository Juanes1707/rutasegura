import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, MapPin, Clock, AlertTriangle, Navigation, Zap, Car, Bike, User, Activity,
  Info, RefreshCw, Eye, Lightbulb, MessageSquare, ExternalLink, Search, X, Route,
  TrendingDown, TrendingUp,
} from 'lucide-react';
import { SafetyMap } from './components/Map';
import { INITIAL_RISK_ZONES, BOGOTA_CENTER } from './constants';
import { VehicleType, TimeMode, RoutePriority, RiskZone, IncidentReport, RouteData } from './types';
import { calculateDynamicRiskScore } from './services/riskEngine';
import { calculateSpeedFromPositions } from './services/geolocation';
import { computeRealRoutes, buildGoogleMapsURL, ComputedRoutes } from './services/routingService';

export default function App() {
  const [vehicle, setVehicle] = useState<VehicleType>(VehicleType.CARRO);
  const [priority, setPriority] = useState<RoutePriority>(RoutePriority.SEGURA);
  const [timeMode, setTimeMode] = useState<TimeMode>(TimeMode.DIA);
  const [zones, setZones] = useState<RiskZone[]>(INITIAL_RISK_ZONES);
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [activeRoute, setActiveRoute] = useState<(RouteData & { riskScore?: number }) | undefined>();
  const [altRoute, setAltRoute] = useState<(RouteData & { riskScore?: number }) | undefined>();
  const [userPos, setUserPos] = useState<[number, number]>(BOGOTA_CENTER);
  const [isCalculating, setIsCalculating] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [origin, setOrigin] = useState('Mi ubicación actual');
  const [destination, setDestination] = useState('');
  const [reportingType, setReportingType] = useState<string | null>(null);
  const [reportComment, setReportComment] = useState('');
  const [gpsStatus, setGpsStatus] = useState<'active' | 'error' | 'pending'>('pending');
  const [showArch, setShowArch] = useState(false);
  const [aiAlert, setAiAlert] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [computedRoutes, setComputedRoutes] = useState<ComputedRoutes | null>(null);
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(null);
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
  const [showOriginSug, setShowOriginSug] = useState(false);
  const [showDestSug, setShowDestSug] = useState(false);

  const lastPosRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const destInputRef = useRef<HTMLInputElement>(null);

  const commonPlaces = [
    'Aeropuerto El Dorado', 'Centro Comercial Andino', 'Parque de la 93',
    'Universidad de los Andes', 'Universidad de La Sabana', 'Portal del Norte',
    'Portal del Sur', 'Centro Internacional', 'La Candelaria', 'Chapinero',
    'Zona Rosa', 'Usaquén', 'Suba', 'Kennedy', 'Bosa', 'Ciudad Bolivar',
    'Engativa', 'Los Martires', 'Zona T', 'Parque Simon Bolivar',
  ];

  const filterSuggestions = (input: string) =>
    input.length < 2 ? [] : commonPlaces.filter(p => p.toLowerCase().includes(input.toLowerCase())).slice(0, 4);

  useEffect(() => {
    let watchId: number | null = null;
    const onSuccess = (position: GeolocationPosition) => {
      const { latitude, longitude, speed: gpsSpeed, accuracy } = position.coords;
      const currentTime = position.timestamp;
      if (accuracy > 100) return;
      setGpsStatus('active');
      setUserPos([latitude, longitude]);
      let calculatedSpeed = 0;
      if (gpsSpeed !== null && gpsSpeed > 0) {
        calculatedSpeed = gpsSpeed * 3.6;
      } else if (lastPosRef.current) {
        calculatedSpeed = calculateSpeedFromPositions(lastPosRef.current, { lat: latitude, lng: longitude, time: currentTime });
      }
      if (calculatedSpeed < 1) calculatedSpeed = 0;
      if (calculatedSpeed > 160) calculatedSpeed = 0;
      setSpeed(Math.round(calculatedSpeed));
      lastPosRef.current = { lat: latitude, lng: longitude, time: currentTime };
    };
    const onError = () => { setGpsStatus('error'); setSpeed(0); };
    if (!navigator.geolocation) {
      setGpsStatus('error');
    } else {
      navigator.geolocation.getCurrentPosition(onSuccess, onError, { enableHighAccuracy: true });
      watchId = navigator.geolocation.watchPosition(onSuccess, onError, { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 });
    }
    return () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId); };
  }, []);

  useEffect(() => {
    const hour = new Date().getHours();
    setTimeMode(hour >= 18 || hour <= 5 ? TimeMode.NOCHE : TimeMode.DIA);
  }, []);

  const centerOnUser = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setUserPos([pos.coords.latitude, pos.coords.longitude]); setGpsStatus('active'); },
        () => setGpsStatus('error'),
        { enableHighAccuracy: true }
      );
    }
  };

  const handleRouteCalc = useCallback(async () => {
    if (!destination.trim()) { setRouteError('Por favor ingresa un destino.'); return; }
    setIsCalculating(true);
    setRouteError(null);
    setAiAlert(null);
    setActiveRoute(undefined);
    setAltRoute(undefined);
    setShowOriginSug(false);
    setShowDestSug(false);
    try {
      const result = await computeRealRoutes(origin, destination, zones, vehicle, timeMode, userPos);
      setComputedRoutes(result);
      setOriginCoords(result.originCoords);
      setDestCoords(result.destCoords);
      const chosen = priority === RoutePriority.SEGURA ? result.safe : result.fast;
      const other = priority === RoutePriority.SEGURA ? result.fast : result.safe;
      setActiveRoute(chosen);
      setAltRoute(other);
      const risk = chosen.riskScore ?? 50;
      if (risk >= 70) {
        setAiAlert('⚠️ ZONA DE ALTO RIESGO (' + risk + '%): La ruta cruza sectores críticos. Se recomienda precaución y horario diurno.');
      } else if (risk >= 45) {
        setAiAlert('🟡 Riesgo moderado (' + risk + '%): Mantén atención en el trayecto. Evita distracciones.');
      } else {
        setAiAlert('✅ Ruta con bajo riesgo (' + risk + '%). Buen momento para viajar.');
      }
    } catch (err: any) {
      setRouteError(err.message || 'No se pudo calcular la ruta. Verifica los datos ingresados.');
    } finally {
      setIsCalculating(false);
    }
  }, [origin, destination, zones, vehicle, timeMode, priority, userPos]);

  const openInGoogleMaps = () => {
    const originStr = originCoords ? originCoords[0] + ',' + originCoords[1] : origin;
    const destStr = destCoords ? destCoords[0] + ',' + destCoords[1] : destination;
    const url = buildGoogleMapsURL(originStr, destStr, vehicle);
    window.open(url, '_blank');
  };

  const switchRoute = () => {
    if (!computedRoutes) return;
    if (activeRoute?.name === 'Ruta segura') {
      setActiveRoute(computedRoutes.fast); setAltRoute(computedRoutes.safe); setPriority(RoutePriority.RAPIDA);
    } else {
      setActiveRoute(computedRoutes.safe); setAltRoute(computedRoutes.fast); setPriority(RoutePriority.SEGURA);
    }
  };

  const submitReport = () => {
    if (!reportingType) return;
    const newReport: IncidentReport = {
      id: Math.random().toString(36).substr(2, 9),
      type: reportingType,
      coords: [userPos[0] + (Math.random() - 0.5) * 0.001, userPos[1] + (Math.random() - 0.5) * 0.001],
      timestamp: Date.now(),
      description: reportComment
    };
    setReports(prev => [newReport, ...prev]);
    setZones(prev => prev.map(z => {
      if (z.id === 1) {
        const riskIncrease = reportingType === 'Seguro' ? -10 : 15;
        return { ...z, baseRisk: Math.max(5, Math.min(100, z.baseRisk + riskIncrease)),
          reportsUnsafe: reportingType === 'Seguro' ? z.reportsUnsafe : z.reportsUnsafe + 1,
          reportsSafe: reportingType === 'Seguro' ? z.reportsSafe + 1 : z.reportsSafe };
      }
      return z;
    }));
    setReportingType(null); setReportComment('');
    alert('Reporte enviado. La red comunitaria ha sido notificada.');
  };

  const currentRisk = activeRoute?.riskScore ?? calculateDynamicRiskScore(vehicle, timeMode, priority);
  const riskColor = currentRisk >= 70 ? '#ff1744' : currentRisk >= 45 ? '#ffc107' : '#00ff9d';

  return (
    <div className="flex h-screen w-full bg-[#07111f] font-sans selection:bg-brand-cyan selection:text-black">
      <AnimatePresence>
        {showArch && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-[#07111fe6] p-8 backdrop-blur-xl"
            onClick={() => setShowArch(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              onClick={e => e.stopPropagation()}
              className="max-w-4xl w-full glass-panel rounded-3xl p-10 overflow-y-auto max-h-[90vh] custom-scrollbar">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-brand-cyan mb-2">Arquitectura RutaSegura AI</h2>
                  <p className="text-slate-400">Integración real: geocodificación + rutas reales + motor de riesgo</p>
                </div>
                <button onClick={() => setShowArch(false)} className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 text-white transition-all">✕</button>
              </div>
              <div className="grid md:grid-cols-4 gap-6 text-center">
                {[
                  { icon: Search, color: 'text-brand-blue', bg: 'bg-blue-500/20', title: '1. Geocodificación', desc: 'Nominatim (OpenStreetMap) convierte direcciones en coordenadas reales de Bogotá.' },
                  { icon: Route, color: 'text-brand-cyan', bg: 'bg-cyan-500/20', title: '2. Rutas Reales', desc: 'OSRM calcula rutas alternativas reales con calles, giros y tiempo de viaje.' },
                  { icon: Shield, color: 'text-green-400', bg: 'bg-green-500/20', title: '3. Motor de Riesgo', desc: 'IA analiza qué zonas de riesgo cruza cada ruta y asigna un score de seguridad.' },
                  { icon: ExternalLink, color: 'text-amber-400', bg: 'bg-amber-500/20', title: '4. Google Maps', desc: 'Abre la ruta óptima en Google Maps con las coordenadas reales calculadas.' },
                ].map(({ icon: Ic, color, bg, title, desc }) => (
                  <div key={title} className="space-y-3">
                    <div className={'h-12 w-12 rounded-xl flex items-center justify-center mx-auto ' + bg + ' ' + color}><Ic size={24} /></div>
                    <h3 className="font-bold text-base">{title}</h3>
                    <p className="text-sm text-slate-400">{desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <aside className="z-10 w-[400px] border-r border-white/5 bg-[#081827] p-6 overflow-y-auto custom-scrollbar flex flex-col gap-5">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-brand-cyan to-brand-blue shadow-[0_0_20px_rgba(0,255,157,0.3)]">
              <Shield className="text-black" size={26} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight uppercase italic">RutaSegura <span className="text-brand-cyan">AI</span></h1>
              <p className="text-[10px] font-bold text-slate-500 tracking-widest">BOGOTÁ SAFETY LAYER</p>
            </div>
          </div>
          <button onClick={() => setShowArch(true)} className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white">
            <Info size={16} />
          </button>
        </header>

        <section className="rounded-2xl bg-white/5 p-5 border border-white/5">
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">Transporte</h2>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: VehicleType.CARRO, icon: Car, label: 'Carro' },
              { id: VehicleType.MOTO, icon: Zap, label: 'Moto' },
              { id: VehicleType.BICICLETA, icon: Bike, label: 'Bici' },
              { id: VehicleType.PEATON, icon: User, label: 'A pie' },
            ].map(({ id, icon: Icon, label }) => (
              <button key={id} onClick={() => setVehicle(id)} title={label}
                className={'flex flex-col h-14 items-center justify-center rounded-xl gap-1 transition-all ' + (vehicle === id ? 'bg-brand-cyan text-black shadow-[0_0_15px_rgba(0,255,157,0.4)]' : 'bg-white/5 text-slate-300 hover:bg-white/10')}>
                <Icon size={18} />
                <span className="text-[9px] font-bold uppercase">{label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white/5 p-5 border border-white/5 space-y-3">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">Tu Ruta</h2>

          <div className="relative">
            <label className="mb-1.5 block text-[10px] font-bold uppercase text-slate-400">Origen</label>
            <div className="relative">
              <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={13} />
              <input type="text" placeholder="Punto de partida..." value={origin}
                onChange={e => { setOrigin(e.target.value); setShowOriginSug(true); }}
                onFocus={() => setShowOriginSug(true)}
                onBlur={() => setTimeout(() => setShowOriginSug(false), 150)}
                className="w-full rounded-xl bg-[#0a1f33] py-2.5 pl-9 pr-8 text-xs font-medium border border-white/5 outline-none focus:border-brand-cyan/50 transition-all" />
              {origin && origin !== 'Mi ubicación actual' && (
                <button onClick={() => setOrigin('Mi ubicación actual')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X size={12} /></button>
              )}
            </div>
            {showOriginSug && filterSuggestions(origin).length > 0 && (
              <div className="absolute z-50 w-full mt-1 rounded-xl bg-[#0d2035] border border-white/10 overflow-hidden shadow-xl">
                {filterSuggestions(origin).map(s => (
                  <button key={s} className="w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:bg-brand-cyan/10 hover:text-brand-cyan transition-colors border-b border-white/5 last:border-0"
                    onMouseDown={() => { setOrigin(s); setShowOriginSug(false); }}>
                    <MapPin size={10} className="inline mr-2 text-slate-500" />{s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <label className="mb-1.5 block text-[10px] font-bold uppercase text-slate-400">Destino</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={13} />
              <input ref={destInputRef} type="text" placeholder="¿A dónde vas?" value={destination}
                onChange={e => { setDestination(e.target.value); setShowDestSug(true); setRouteError(null); }}
                onFocus={() => setShowDestSug(true)}
                onBlur={() => setTimeout(() => setShowDestSug(false), 150)}
                onKeyDown={e => { if (e.key === 'Enter') handleRouteCalc(); }}
                className="w-full rounded-xl bg-[#0a1f33] py-2.5 pl-9 pr-8 text-xs font-medium border border-white/5 outline-none focus:border-brand-cyan/50 transition-all" />
              {destination && (
                <button onClick={() => { setDestination(''); setComputedRoutes(null); setActiveRoute(undefined); setAltRoute(undefined); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X size={12} /></button>
              )}
            </div>
            {showDestSug && filterSuggestions(destination).length > 0 && (
              <div className="absolute z-50 w-full mt-1 rounded-xl bg-[#0d2035] border border-white/10 overflow-hidden shadow-xl">
                {filterSuggestions(destination).map(s => (
                  <button key={s} className="w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:bg-brand-cyan/10 hover:text-brand-cyan transition-colors border-b border-white/5 last:border-0"
                    onMouseDown={() => { setDestination(s); setShowDestSug(false); }}>
                    <MapPin size={10} className="inline mr-2 text-slate-500" />{s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {routeError && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-[10px] text-red-400 font-bold flex items-center gap-2"><AlertTriangle size={11} /> {routeError}</p>
            </motion.div>
          )}

          <button onClick={handleRouteCalc} disabled={isCalculating}
            className="w-full rounded-xl bg-linear-to-r from-brand-cyan to-brand-blue py-3 px-4 text-xs font-black text-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 disabled:opacity-60 transition-all flex items-center justify-center gap-2">
            {isCalculating
              ? <><RefreshCw size={14} className="animate-spin" /> Analizando ruta real...</>
              : <><Search size={14} /> Calcular Ruta Segura</>}
          </button>

          {computedRoutes && (
            <motion.button initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              onClick={openInGoogleMaps}
              className="w-full rounded-xl py-3 px-4 text-[10px] font-black uppercase tracking-widest border border-brand-blue/40 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20 transition-all flex items-center justify-center gap-2">
              <ExternalLink size={13} /> Abrir esta ruta en Google Maps
            </motion.button>
          )}
        </section>

        <AnimatePresence>
          {activeRoute && (
            <motion.section initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-2xl bg-brand-cyan/5 p-5 border border-brand-cyan/20">
              <h2 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-brand-cyan font-mono flex items-center gap-2">
                <Activity size={13} /> Análisis de Ruta
              </h2>

              {aiAlert && (
                <div className={'mb-4 p-3 rounded-xl border ' + ((activeRoute.riskScore ?? 50) >= 70 ? 'bg-red-500/10 border-red-500/20' : (activeRoute.riskScore ?? 50) >= 45 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-green-500/10 border-green-500/20')}>
                  <p className={'text-[10px] font-bold flex items-start gap-2 ' + ((activeRoute.riskScore ?? 50) >= 70 ? 'text-red-400' : (activeRoute.riskScore ?? 50) >= 45 ? 'text-amber-400' : 'text-green-400')}>
                    {aiAlert}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { icon: Clock, val: activeRoute.time + '', unit: 'min', color: 'text-brand-blue' },
                  { icon: Route, val: activeRoute.distance + '', unit: 'km', color: 'text-brand-blue' },
                  { icon: Shield, val: (activeRoute.riskScore ?? '—') + '%', unit: 'riesgo', color: '' },
                ].map(({ icon: Ic, val, unit, color }, i) => (
                  <div key={i} className="rounded-xl bg-[#0a1f33] p-3 text-center">
                    <Ic size={12} className={'mx-auto mb-1 ' + (i === 2 ? '' : color)} style={i === 2 ? { color: riskColor } : {}} />
                    <div className="text-lg font-bold font-mono" style={i === 2 ? { color: riskColor } : {}}>{val}</div>
                    <div className="text-[9px] text-slate-500 uppercase font-bold">{unit}</div>
                  </div>
                ))}
              </div>

              <div className="mb-4">
                <div className="flex justify-between mb-1.5">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Índice de seguridad</span>
                  <span className="text-[9px] font-bold" style={{ color: riskColor }}>
                    {(activeRoute.riskScore ?? 50) < 45 ? 'SEGURO' : (activeRoute.riskScore ?? 50) < 70 ? 'MODERADO' : 'PELIGROSO'}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <motion.div animate={{ width: (activeRoute.riskScore ?? 50) + '%' }} transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full rounded-full" style={{ backgroundColor: riskColor }} />
                </div>
              </div>

              {altRoute && (
                <button onClick={switchRoute}
                  className="w-full mb-3 rounded-xl bg-white/5 border border-white/10 py-2.5 px-4 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                  {activeRoute.name === 'Ruta segura'
                    ? <><TrendingUp size={12} /> Ver ruta rápida ({altRoute.time} min / {altRoute.riskScore}% riesgo)</>
                    : <><TrendingDown size={12} /> Ver ruta segura ({altRoute.time} min / {altRoute.riskScore}% riesgo)</>}
                </button>
              )}

              <div>
                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Instrucciones</h3>
                <div className="space-y-1.5">
                  {activeRoute.instructions.slice(0, 5).map((inst, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] text-slate-400">
                      <div className="h-4 w-4 rounded-full bg-brand-cyan/20 text-brand-cyan flex items-center justify-center text-[8px] font-black shrink-0">{i + 1}</div>
                      {inst}
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <section className="rounded-2xl bg-white/5 p-5 border border-white/5">
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">Reporte en Vivo</h2>
          <AnimatePresence mode="wait">
            {!reportingType ? (
              <motion.div key="grid" className="grid grid-cols-2 gap-2">
                {['Sospecha', 'Sin Luz', 'Robo', 'Seguro'].map(label => (
                  <button key={label} onClick={() => setReportingType(label)}
                    className="flex items-center justify-center gap-1 rounded-lg py-2 text-[10px] font-bold uppercase transition-all bg-white/5 border border-white/5 hover:bg-white/10 text-slate-300">
                    {label}
                  </button>
                ))}
              </motion.div>
            ) : (
              <motion.div key="form" className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[10px] font-black text-brand-cyan uppercase tracking-tighter">Evento: {reportingType}</span>
                  <button onClick={() => setReportingType(null)} className="text-slate-500 hover:text-white uppercase text-[9px] font-bold">cancelar</button>
                </div>
                <textarea placeholder="Describe la situación..." value={reportComment}
                  onChange={e => setReportComment(e.target.value)}
                  className="w-full min-h-[70px] rounded-xl bg-[#0a1f33] p-3 text-[10px] border border-white/5 outline-none resize-none text-slate-300" />
                <button onClick={submitReport} className="w-full rounded-lg bg-brand-cyan py-2.5 text-[10px] font-black text-black uppercase">Notificar a la Red</button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <section className="rounded-2xl bg-brand-cyan/5 p-5 border border-brand-cyan/10">
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-brand-cyan font-mono flex items-center gap-2">
            <Shield size={13} /> Insights ProBogotá 2024
          </h2>
          <div className="p-3 rounded-xl bg-[#0a1f33] border border-white/5 mb-3">
            <span className="text-[9px] font-bold text-slate-500 uppercase block mb-2">Localidades Críticas</span>
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2 py-1 rounded-md bg-red-500/20 text-red-400 text-[9px] font-bold">Los Mártires (2.1)</span>
              <span className="px-2 py-1 rounded-md bg-amber-500/20 text-amber-400 text-[9px] font-bold">Engativá (4.2)</span>
              <span className="px-2 py-1 rounded-md bg-amber-500/20 text-amber-400 text-[9px] font-bold">Cd. Bolívar (4.6)</span>
            </div>
          </div>
          <div className="space-y-1.5">
            {[
              { ic: AlertTriangle, t: 'Reportar fachadas abandonadas.' },
              { ic: Info, t: 'Prefiere rutas comerciales (Chapinero).' },
              { ic: MessageSquare, t: 'Fortalecer frentes de seguridad local.' },
            ].map(({ ic: Ic, t }) => (
              <div key={t} className="flex items-start gap-2 text-[10px] text-slate-400 leading-tight">
                <Ic size={11} className="shrink-0 text-brand-blue mt-0.5" /> {t}
              </div>
            ))}
          </div>
        </section>
      </aside>

      <main className="relative flex-1">
        <div className="absolute top-6 left-6 z-[1000] flex gap-3 pointer-events-auto">
          <button onClick={centerOnUser}
            className="glass-panel rounded-2xl p-3.5 flex items-center justify-center text-brand-cyan hover:bg-brand-cyan/10 transition-all active:scale-90"
            title="Centrar en mi ubicación">
            <Navigation size={20} className="rotate-45" />
          </button>
          <div className="glass-panel rounded-2xl p-3.5 min-w-[130px]">
            <span className="text-[9px] uppercase font-black text-slate-500 flex justify-between mb-1 tracking-tighter">
              Velocidad Real
              <span className={'h-2 w-2 rounded-full animate-pulse ' + (gpsStatus === 'active' ? 'bg-brand-cyan shadow-[0_0_10px_#00ff9d]' : 'bg-red-500')} />
            </span>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold font-mono tracking-tighter">{speed}</span>
              <span className="text-[9px] font-bold text-slate-500 mb-1.5 uppercase">km/h</span>
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-3.5 min-w-[180px]">
            <span className="text-[9px] uppercase font-black text-slate-500 block mb-1 tracking-tighter">Riesgo Actual</span>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 rounded-full bg-slate-800/50 overflow-hidden">
                <motion.div animate={{ width: currentRisk + '%' }} transition={{ duration: 0.5 }} className="h-full" style={{ backgroundColor: riskColor }} />
              </div>
              <span className="text-xl font-bold font-mono" style={{ color: riskColor }}>{currentRisk}%</span>
            </div>
          </div>
        </div>

        <div className="h-full w-full">
          <SafetyMap zones={zones} reports={reports} vehicleType={vehicle} timeMode={timeMode}
            activeRoute={activeRoute} userLocation={userPos}
            originCoords={originCoords} destCoords={destCoords} />
        </div>
      </main>
    </div>
  );
}
