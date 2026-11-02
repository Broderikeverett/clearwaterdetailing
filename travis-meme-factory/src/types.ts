export type Align = 'left' | 'center' | 'right';
export type TextTransform = 'none' | 'upper' | 'mock';

interface LayerBase {
  id: string;
  /** center x in design pixels */
  x: number;
  /** center y in design pixels */
  y: number;
  /** rotation in degrees */
  rotation: number;
  hidden?: boolean;
}

export interface TextLayer extends LayerBase {
  type: 'text';
  text: string;
  font: string;
  fontSize: number;
  /** wrap width in design pixels */
  w: number;
  color: string;
  stroke: string;
  strokeWidth: number;
  align: Align;
  transform: TextTransform;
  /** optional background fill behind text (e.g. news chyrons) */
  bg?: string;
  shadow?: boolean;
}

export interface StickerLayer extends LayerBase {
  type: 'sticker';
  emoji: string;
  size: number;
}

export interface ImageLayer extends LayerBase {
  type: 'image';
  src: string;
  w: number;
  h: number;
  shape: 'rect' | 'circle';
  border?: string;
}

export type Layer = TextLayer | StickerLayer | ImageLayer;

export type Background =
  | { kind: 'template'; templateId: string }
  | { kind: 'image'; src: string; natW: number; natH: number; zoom: number; panX: number; panY: number }
  | { kind: 'color'; color: string };

export interface Meme {
  id: string;
  title: string;
  width: number;
  height: number;
  /** aspect choice for photo memes */
  aspect: AspectKey;
  background: Background;
  layers: Layer[];
  collectionId: string | null;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
}

export type AspectKey = 'original' | '1:1' | '4:5' | '9:16' | '16:9';

export interface Collection {
  id: string;
  name: string;
  emoji: string;
  createdAt: number;
}

export interface Photo {
  id: string;
  src: string;
  w: number;
  h: number;
  createdAt: number;
}

export interface LeaderboardEntry {
  id: string;
  memeId: string | null;
  meme: Meme;
  thumbnail: string;
  title: string;
  rating: number;
  wins: number;
  losses: number;
  updatedAt: number;
}

export interface TemplateSlot {
  x: number;
  y: number;
  w: number;
  h: number;
  shape?: 'rect' | 'circle';
}

export interface MemeTemplate {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  /** default caption boxes; `{CAPTIONS}` are filled by the random generator */
  texts: Array<Partial<TextLayer> & { x: number; y: number; w: number; text: string }>;
  /** good places to paste Travis's face */
  slots: TemplateSlot[];
  /** captions the random generator can drop into this template, one array per text box */
  captionSets: string[][];
}
