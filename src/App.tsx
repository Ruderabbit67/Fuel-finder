/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  orderBy, 
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User 
} from './firebase';
import { handleFirestoreError, OperationType } from './lib/firebase-utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Fuel, 
  MapPin, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Timer, 
  Plus, 
  Edit2, 
  LogOut, 
  LogIn,
  Filter,
  Search,
  Info,
  Map as MapIcon,
  List as ListIcon,
  Crosshair,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Navigation
} from 'lucide-react';

// Leaflet
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet default icon issue
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom icons for status
const getStatusIcon = (status: string) => {
  const color = status === 'verde' ? '#10b981' : status === 'amarelo' ? '#f59e0b' : '#f43f5e';
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });
};

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface Station {
  id: string;
  name: string;
  neighborhood: string;
  status: 'verde' | 'amarelo' | 'vermelho';
  observations?: string;
  updatedAt: string;
  updatedBy: string;
  latitude?: number;
  longitude?: number;
}

function LocationPicker({ onLocationSelect, initialPosition }: { onLocationSelect: (lat: number, lng: number) => void, initialPosition?: [number, number] }) {
  const [position, setPosition] = useState<[number, number] | null>(initialPosition || null);

  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });

  return position === null ? null : (
    <Marker position={position} />
  );
}

function MapRecenter({ lat, lng }: { lat?: number, lng?: number }) {
  const map = useMapEvents({});
  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], 15);
    }
  }, [lat, lng, map]);
  return null;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('todos');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [expandedStationId, setExpandedStationId] = useState<string | null>(null);
  
  // Form State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    neighborhood: '',
    status: 'verde' as Station['status'],
    observations: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined
  });

  // Map Center (Maputo)
  const maputoCenter: [number, number] = [-25.9667, 32.5833];

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Listener
  useEffect(() => {
    const q = query(collection(db, 'stations'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stationsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Station[];
      setStations(stationsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'stations');
    });

    return () => unsubscribe();
  }, []);

  // Test Connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          toast.error("Erro de conexão com o Firebase. Verifique sua rede.");
        }
      }
    }
    testConnection();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Login realizado com sucesso!");
    } catch (error) {
      toast.error("Erro ao fazer login.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Sessão encerrada.");
    } catch (error) {
      toast.error("Erro ao encerrar sessão.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      ...formData,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.uid || 'guest',
      latitude: formData.latitude,
      longitude: formData.longitude
    };

    try {
      if (editingStation) {
        await updateDoc(doc(db, 'stations', editingStation.id), payload);
        toast.success("Relatório atualizado!");
      } else {
        await addDoc(collection(db, 'stations'), payload);
        toast.success("Novo posto reportado!");
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingStation ? OperationType.UPDATE : OperationType.CREATE, 'stations');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      neighborhood: '',
      status: 'verde',
      observations: '',
      latitude: undefined,
      longitude: undefined
    });
    setEditingStation(null);
  };

  const openEdit = (station: Station) => {
    setEditingStation(station);
    setFormData({
      name: station.name,
      neighborhood: station.neighborhood,
      status: station.status,
      observations: station.observations || '',
      latitude: station.latitude,
      longitude: station.longitude
    });
    setIsDialogOpen(true);
  };

  const filteredStations = useMemo(() => {
    return stations.filter(s => {
      const matchesFilter = filter === 'todos' || s.status === filter;
      const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || 
                           s.neighborhood.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [stations, filter, search]);

  const stats = useMemo(() => {
    return {
      verde: stations.filter(s => s.status === 'verde').length,
      amarelo: stations.filter(s => s.status === 'amarelo').length,
      vermelho: stations.filter(s => s.status === 'vermelho').length,
    };
  }, [stations]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans pb-20">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center">
            <Fuel className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight leading-none">
              Há Combustível
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">Maputo</p>
          </div>
        </div>
        
        {user ? (
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold">{user.displayName}</p>
              <button onClick={handleLogout} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 ml-auto transition-colors">
                Sair <LogOut className="w-3 h-3" />
              </button>
            </div>
            <img src={user.photoURL || ''} alt="User" className="w-8 h-8 rounded-full border border-border" referrerPolicy="no-referrer" />
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={handleLogin} className="rounded-lg border-border hover:bg-muted font-semibold text-xs">
            <LogIn className="w-4 h-4 mr-2" /> Entrar
          </Button>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Stats Summary - Bento Style */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <section className="bento-card">
            <h2 className="bento-card-title">Disponível</h2>
            <div className="text-4xl font-black text-emerald-600 tracking-tighter">{stats.verde}</div>
            <div className="text-[11px] text-muted-foreground mt-1 font-medium">Postos sem fila</div>
            <div className="mt-4 h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: `${(stats.verde / (stations.length || 1)) * 100}%` }} />
            </div>
          </section>

          <section className="bento-card">
            <h2 className="bento-card-title">Com Fila</h2>
            <div className="text-4xl font-black text-amber-600 tracking-tighter">{stats.amarelo}</div>
            <div className="text-[11px] text-muted-foreground mt-1 font-medium">Espera reportada</div>
            <div className="mt-4 h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-amber-500" style={{ width: `${(stats.amarelo / (stations.length || 1)) * 100}%` }} />
            </div>
          </section>

          <section className="bento-card">
            <h2 className="bento-card-title">Esgotado</h2>
            <div className="text-4xl font-black text-rose-600 tracking-tighter">{stats.vermelho}</div>
            <div className="text-[11px] text-muted-foreground mt-1 font-medium">Sem combustível</div>
            <div className="mt-4 h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-rose-500" style={{ width: `${(stats.vermelho / (stations.length || 1)) * 100}%` }} />
            </div>
          </section>
        </div>

        {/* View Mode Switcher - Above Main Card */}
        <div className="flex justify-center">
          <div className="bg-muted/50 p-1 rounded-xl flex gap-1 border border-border">
            <Button 
              variant={viewMode === 'list' ? 'default' : 'ghost'} 
              size="sm" 
              className={`text-[10px] h-8 px-6 rounded-lg transition-all ${viewMode === 'list' ? 'shadow-sm' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <ListIcon className="w-3.5 h-3.5 mr-2" /> Lista
            </Button>
            <Button 
              variant={viewMode === 'map' ? 'default' : 'ghost'} 
              size="sm" 
              className={`text-[10px] h-8 px-6 rounded-lg transition-all ${viewMode === 'map' ? 'shadow-sm' : ''}`}
              onClick={() => setViewMode('map')}
            >
              <MapIcon className="w-3.5 h-3.5 mr-2" /> Mapa
            </Button>
          </div>
        </div>

        {/* Station List or Map - Large Bento Card with Integrated Filters */}
        <section className="bento-card overflow-hidden p-0">
          <div className="p-5 border-b border-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h2 className="bento-card-title mb-0">{viewMode === 'list' ? 'Registros Recentes' : 'Mapa de Postos'}</h2>
                <Badge variant="outline" className="text-[10px] font-bold border-border">
                  {filteredStations.length} postos
                </Badge>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input 
                    placeholder="Procurar posto ou bairro..." 
                    className="pl-9 h-9 text-xs bg-muted/50 border-border rounded-lg w-full"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Tabs defaultValue="todos" value={filter} onValueChange={setFilter} className="w-full sm:w-auto">
                  <TabsList className="grid grid-cols-4 gap-1 bg-muted/50 p-1 rounded-lg h-9">
                    <TabsTrigger value="todos" className="text-[10px] px-3">Todos</TabsTrigger>
                    <TabsTrigger value="verde" className="text-[10px] px-3 data-[state=active]:bg-emerald-500 data-[state=active]:text-white">Verde</TabsTrigger>
                    <TabsTrigger value="amarelo" className="text-[10px] px-3 data-[state=active]:bg-amber-500 data-[state=active]:text-white">Amarelo</TabsTrigger>
                    <TabsTrigger value="vermelho" className="text-[10px] px-3 data-[state=active]:bg-rose-500 data-[state=active]:text-white">Vermelho</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </div>
          
          <div className="relative h-[600px]">
            {viewMode === 'list' ? (
              <div className="overflow-auto h-full">
                {loading ? (
                  <div className="py-20 text-center text-muted-foreground">
                    <Timer className="w-8 h-8 animate-spin mx-auto mb-2 opacity-20" />
                    <p className="text-sm">A carregar postos...</p>
                  </div>
                ) : filteredStations.length === 0 ? (
                  <div className="py-20 text-center text-muted-foreground">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-10" />
                    <p className="text-sm">Nenhum posto encontrado.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-muted/30 sticky top-0 z-10">
                      <tr>
                        <th className="px-5 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border">Posto</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border hidden sm:table-cell">Bairro</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border">Status</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStations.map((station) => (
                        <React.Fragment key={station.id}>
                          <tr 
                            className={`group hover:bg-muted/20 transition-colors cursor-pointer ${expandedStationId === station.id ? 'bg-muted/30' : ''}`}
                            onClick={() => setExpandedStationId(expandedStationId === station.id ? null : station.id)}
                          >
                            <td className="px-5 py-4 border-b border-border/50">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  {expandedStationId === station.id ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                                  <span className="font-bold text-sm">{station.name}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  {formatDistanceToNow(new Date(station.updatedAt), { addSuffix: true, locale: ptBR })}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4 border-b border-border/50 hidden sm:table-cell">
                              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {station.neighborhood}
                              </span>
                            </td>
                            <td className="px-5 py-4 border-b border-border/50">
                              <Badge className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-md shadow-none ${
                                station.status === 'verde' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 
                                station.status === 'amarelo' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100' : 
                                'bg-rose-100 text-rose-700 hover:bg-rose-100'
                              }`}>
                                {station.status === 'verde' ? 'Disponível' : 
                                 station.status === 'amarelo' ? 'Com Fila' : 'Esgotado'}
                              </Badge>
                            </td>
                            <td className="px-5 py-4 border-b border-border/50 text-right">
                              <Button 
                                variant="secondary" 
                                size="sm" 
                                className="h-7 px-2 text-[10px] font-bold bg-primary-soft text-primary hover:bg-primary hover:text-white transition-all"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEdit(station);
                                }}
                              >
                                EDITAR
                              </Button>
                            </td>
                          </tr>
                          {expandedStationId === station.id && (
                            <tr className="bg-muted/10">
                              <td colSpan={4} className="px-5 py-6 border-b border-border/50">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-3">
                                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Detalhes do Posto</h4>
                                    <div className="space-y-2">
                                      <p className="text-xs text-muted-foreground leading-relaxed">
                                        <span className="font-bold text-foreground">Observações:</span><br />
                                        {station.observations || 'Nenhuma observação registada.'}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground">
                                        <span className="font-bold">Última atualização por:</span> {station.updatedBy === 'guest' ? 'Visitante' : 'Utilizador'}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-3">
                                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Navegação</h4>
                                    {station.latitude && station.longitude ? (
                                      <div className="flex flex-wrap gap-2">
                                        <Button 
                                          variant="outline" 
                                          size="sm" 
                                          className="h-8 text-[10px] bg-white"
                                          onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${station.latitude},${station.longitude}`, '_blank')}
                                        >
                                          <Navigation className="w-3 h-3 mr-1.5 text-blue-600" /> Google Maps
                                        </Button>
                                        <Button 
                                          variant="outline" 
                                          size="sm" 
                                          className="h-8 text-[10px] bg-white"
                                          onClick={() => window.open(`https://waze.com/ul?ll=${station.latitude},${station.longitude}&navigate=yes`, '_blank')}
                                        >
                                          <ExternalLink className="w-3 h-3 mr-1.5 text-cyan-500" /> Waze
                                        </Button>
                                        <Button 
                                          variant="outline" 
                                          size="sm" 
                                          className="h-8 text-[10px] bg-white"
                                          onClick={() => window.open(`https://maps.apple.com/?q=${station.latitude},${station.longitude}`, '_blank')}
                                        >
                                          <MapIcon className="w-3 h-3 mr-1.5 text-gray-700" /> Apple Maps
                                        </Button>
                                      </div>
                                    ) : (
                                      <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" /> Coordenadas não disponíveis para este posto.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              <div className="h-full w-full z-0">
                <MapContainer center={maputoCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  {filteredStations.filter(s => s.latitude && s.longitude).map(station => (
                    <Marker 
                      key={station.id} 
                      position={[station.latitude!, station.longitude!]} 
                      icon={getStatusIcon(station.status)}
                    >
                      <Popup>
                        <div className="p-1">
                          <h3 className="font-bold text-sm">{station.name}</h3>
                          <p className="text-[10px] text-gray-500">{station.neighborhood}</p>
                          <Badge className={`text-[9px] mt-2 ${
                            station.status === 'verde' ? 'bg-emerald-500' : 
                            station.status === 'amarelo' ? 'bg-amber-500' : 'bg-rose-500'
                          }`}>
                            {station.status === 'verde' ? 'Disponível' : 
                             station.status === 'amarelo' ? 'Com Fila' : 'Esgotado'}
                          </Badge>
                          <div className="flex flex-col gap-1 mt-3">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full h-7 text-[10px]"
                              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${station.latitude},${station.longitude}`, '_blank')}
                            >
                              <Navigation className="w-3 h-3 mr-1 text-blue-600" /> Google Maps
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full h-7 text-[10px]"
                              onClick={() => openEdit(station)}
                            >
                              Editar
                            </Button>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-border bg-muted/10 text-center">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
              Dados colaborativos · Atualizado em tempo real
            </p>
          </div>
        </section>
      </main>

      {/* Floating Action Button */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogTrigger 
          render={
            <Button 
              className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl bg-orange-600 hover:bg-orange-700 text-white p-0"
            />
          }
        >
          <Plus className="w-8 h-8" />
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingStation ? 'Editar Relatório' : 'Reportar Posto'}</DialogTitle>
            <DialogDescription>
              Ajude a comunidade informando o estado atual deste posto. 
              {!user && <span className="block mt-1 text-orange-600 font-bold">A reportar como Visitante.</span>}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Posto</Label>
              <Input 
                id="name" 
                placeholder="Ex: Galp Marginal" 
                required 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="neighborhood">Bairro</Label>
              <Input 
                id="neighborhood" 
                placeholder="Ex: Polana" 
                required 
                value={formData.neighborhood}
                onChange={(e) => setFormData({...formData, neighborhood: e.target.value})}
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Localização (Clique no mapa)</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="xs" 
                  className="h-7 text-[10px] flex items-center gap-1"
                  onClick={() => {
                    if (!navigator.geolocation) {
                      toast.error("Geolocalização não suportada pelo navegador.");
                      return;
                    }
                    toast.info("A obter localização...");
                    navigator.geolocation.getCurrentPosition(
                      (position) => {
                        setFormData({
                          ...formData,
                          latitude: position.coords.latitude,
                          longitude: position.coords.longitude
                        });
                        toast.success("Localização obtida!");
                      },
                      (error) => {
                        console.error(error);
                        toast.error("Erro ao obter localização. Verifique as permissões.");
                      }
                    );
                  }}
                >
                  <Crosshair className="w-3 h-3" /> Usar minha localização
                </Button>
              </div>
              <div className="h-40 w-full rounded-lg overflow-hidden border border-border">
                <MapContainer center={editingStation?.latitude ? [editingStation.latitude, editingStation.longitude!] : maputoCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapRecenter lat={formData.latitude} lng={formData.longitude} />
                  <LocationPicker 
                    initialPosition={formData.latitude ? [formData.latitude, formData.longitude!] : undefined}
                    onLocationSelect={(lat, lng) => setFormData({...formData, latitude: lat, longitude: lng})} 
                  />
                </MapContainer>
              </div>
              <div className="flex gap-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><Crosshair className="w-3 h-3" /> Lat: {formData.latitude?.toFixed(4) || '—'}</span>
                <span className="flex items-center gap-1"><Crosshair className="w-3 h-3" /> Lng: {formData.longitude?.toFixed(4) || '—'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select 
                value={formData.status} 
                onValueChange={(v: any) => setFormData({...formData, status: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="verde">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" /> Disponível
                    </div>
                  </SelectItem>
                  <SelectItem value="amarelo">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500" /> Com Fila
                    </div>
                  </SelectItem>
                  <SelectItem value="vermelho">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-rose-500" /> Esgotado
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="obs">Observações (Opcional)</Label>
              <Textarea 
                id="obs" 
                placeholder="Ex: Fila de 20 min, só gasóleo..." 
                value={formData.observations}
                onChange={(e) => setFormData({...formData, observations: e.target.value})}
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700">
                {editingStation ? 'Guardar Alterações' : 'Enviar Relatório'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Footer Info */}
      <footer className="mt-8 px-6 py-10 text-center space-y-4 border-t border-gray-200">
        <div className="flex justify-center gap-2">
          <Badge variant="outline" className="text-[10px] border-gray-300">Comunidade Maputo</Badge>
          <Badge variant="outline" className="text-[10px] border-gray-300">Tempo Real</Badge>
        </div>
        <p className="text-[10px] text-gray-400 leading-relaxed max-w-xs mx-auto">
          Os dados são fornecidos por utilizadores. Verifique sempre a data da última atualização.
        </p>
      </footer>
    </div>
  );
}
