import { KymaItem } from '../db/client';

export type DoorId = 'agenda' | 'tareas' | 'notas' | 'intereses' | 'personas' | 'reflexiones' | 'estela';
export type DoorCategory = 'utilidad' | 'mapa';

export interface TriageResult {
  isFicheable: boolean;
  category?: DoorCategory;
  doorId?: DoorId;
  confidence: number;
  relevantSnippet?: string;
}

export interface ExtractedItemData {
  title: string;
  content: string;
  peso?: 1 | 2 | 3;
  eventDate?: string;
  eventTime?: string;
  completed?: boolean;
  cercania?: 'nucleo' | 'cercana' | 'orbita';
  frecuenciaContacto?: 'diario' | 'semanal' | 'mensual' | 'anual';
  frecuencia?: number;
  year?: number;
  dateStr?: string;
  lugar?: string;
  emocion?: 1 | 2 | 3 | 4 | 5;
  tags?: string[];
}

export interface ExtractionResult {
  doorId: DoorId;
  action: 'create' | 'enrich' | 'none';
  targetItemId?: string;
  extractedData?: ExtractedItemData;
  reasoning?: string;
}

export interface DoorPackage {
  doorId: DoorId;
  category: DoorCategory;
  guardrails: string[];
  systemInstruction: string;
}
