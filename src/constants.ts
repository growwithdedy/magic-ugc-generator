import React from 'react';
import { VoiceOption, LanguageOption, ToneOption, StoryboardType } from './types';

export const VOICE_OPTIONS: VoiceOption[] = [
  { name: 'Kore', label: 'Citra (Wanita)', gender: 'Wanita', style: 'Tenang, Elegan, Profesional', langCode: 'en-US' },
  { name: 'Puck', label: 'Bima (Pria)', gender: 'Pria', style: 'Energik, Percaya Diri, Penuh Semangat', langCode: 'en-US' },
  { name: 'Zephyr', label: 'Rina (Wanita)', gender: 'Wanita', style: 'Jelas, Breezy, Ramah', langCode: 'en-US' },
  { name: 'Fenrir', label: 'Jaya (Pria)', gender: 'Pria', style: 'Dalam, Berwibawa, Informatif', langCode: 'en-US' },
  { name: 'Achird', label: 'Risma (Wanita)', gender: 'Wanita', style: 'Ceria, Mudah Bergaul, Hangat', langCode: 'en-US' },
];

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'id-ID', name: 'Bahasa Indonesia' },
  { code: 'en-US', name: 'English (US)' },
  { code: 'ja-JP', name: 'Japanese' },
  { code: 'ko-KR', name: 'Korean' },
];

export const TONE_OPTIONS: ToneOption[] = [
  { value: 'CHEERFUL', label: 'Ceria', prompt: 'Say cheerfully: ' },
  { value: 'SPOOKY', label: 'Mencekam', prompt: 'Say in a spooky whisper: ' },
  { value: 'FORMAL', label: 'Formal', prompt: 'Say in a formal, informative tone: ' },
  { value: 'CASUAL', label: 'Santai', prompt: 'Say casually: ' },
  { value: 'ANGRY', label: 'Marah', prompt: 'Say in an angry tone: ' },
  { value: 'SCARED', label: 'Takut', prompt: 'Say in a scared, trembling voice: ' },
  { value: 'SAD', label: 'Sedih', prompt: 'Say in a sad, crying tone: ' },
  { value: 'LAUGHING', label: 'Ketawa', prompt: 'Say with laughter: ' },
];

export const DURATION_OPTIONS = [
  { value: '10', label: '10 Detik (Singkat)' },
  { value: '15', label: '15 Detik (Story/Reels)' },
  { value: '30', label: '30 Detik (Standard Ads)' },
  { value: '45', label: '45 Detik (Detailed)' },
  { value: '60', label: '60 Detik (Explainer)' },
];

export const SCENE_COUNT_OPTIONS = [
  { value: 4, label: '4 Scenes (Teaser)' },
  { value: 8, label: '8 Scenes (Short Story)' },
  { value: 12, label: '12 Scenes (Full Story)' },
];

export const MODEL_FOCUS_MODES = [
  { value: 'MIX', label: 'Balanced', description: 'Model & Produk seimbang.' },
  { value: 'MODEL', label: 'Model Priority', description: 'Fokus gaya & pose model.' },
  { value: 'PRODUCT', label: 'Product Priority', description: 'Fokus detail produk.' },
];

export const PRODUCT_FOCUS_MODES = [
  { value: 'PRODUCT_ONLY', label: 'Still Life (No Human)', description: 'Fokus murni pada estetika produk.' },
  { value: 'HAND_REVIEW', label: 'Hand Interaction', description: 'Tangan model memegang produk.' },
];

export const STORYBOARD_TYPES: StoryboardType[] = [
  { 
    value: 'COMMERCIAL', 
    label: 'Komersial / Iklan', 
    icon: React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", width: "28", height: "28", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" }, 
      React.createElement('circle', { cx: "12", cy: "12", r: "10" }),
      React.createElement('path', { d: "m14.31 8 5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16 3.95 6.06M14.31 16H2.83m13.79-4-5.74 9.94" })
    ), 
    description: 'Studio profesional, pencahayaan sempurna.' 
  },
  { 
    value: 'UGC', 
    label: 'UGC / Creator', 
    icon: React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", width: "28", height: "28", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" }, 
      React.createElement('rect', { width: "14", height: "20", x: "5", y: "2", rx: "2" }),
      React.createElement('path', { d: "M12 18h.01" })
    ), 
    description: 'Gaya kreator, autentik, relatable.' 
  },
  { 
    value: 'CINEMATIC', 
    label: 'Cinematic Movie', 
    icon: React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", width: "28", height: "28", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" }, 
      React.createElement('rect', { width: "18", height: "18", x: "3", y: "3", rx: "2" }),
      React.createElement('path', { d: "M7 3v18M17 3v18M3 7.5h4M3 12h4M3 16.5h4M17 7.5h4M17 12h4M17 16.5h4" })
    ), 
    description: 'Layar lebar, dramatis, color grading film.' 
  },
];

export const FALLBACK_MODEL_SHOTS = [
  { 
    name: 'Classic Product Interaction', 
    prompt: 'Medium shot. Model holding the product naturally, looking at it with a slight smile. Focus on the interaction between hand and product.',
    videoPrompt: 'Cinematic medium shot, model holding product, examining it gently, soft lighting, 4k',
    script: 'Lihat produk luar biasa ini, sangat cocok untuk gaya Anda.'
  }
];
