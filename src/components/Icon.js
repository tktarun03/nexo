// Icons: a small Lucide subset (tree-shaken) plus simple brand glyphs that Lucide doesn't ship.
import {
  createElement, ArrowLeft, AtSign, Briefcase, Building2, Cake, Camera, Check, ChevronDown, ChevronRight, ChevronLeft,
  CircleAlert, CircleCheck, Contact, Copy, Download, ExternalLink, Eye, EyeOff, FileText, Flashlight, Globe, GripVertical,
  HardDrive, History, Image, ImagePlus, Info, Layers, Lock, Mail, MapPin, MessageSquare, Minus, Monitor, Moon, Palette,
  Pencil, Phone, Plus, QrCode, Quote, RotateCcw, ScanLine, ScanQrCode, Settings, Share2, Shield, ShieldCheck,
  SlidersHorizontal, Smartphone, Smile, Sparkles, Star, Sun, Tag, Trash2, Type, Upload, User, Wand2, X, Zap,
} from 'lucide';

const LUCIDE = {
  ArrowLeft, AtSign, Briefcase, Building2, Cake, Camera, Check, ChevronDown, ChevronRight, ChevronLeft, CircleAlert,
  CircleCheck, Contact, Copy, Download, ExternalLink, Eye, EyeOff, FileText, Flashlight, Globe, GripVertical, HardDrive,
  History, Image, ImagePlus, Info, Layers, Lock, Mail, MapPin, MessageSquare, Minus, Monitor, Moon, Palette, Pencil,
  Phone, Plus, QrCode, Quote, RotateCcw, ScanLine, ScanQrCode, Settings, Share2, Shield, ShieldCheck, SlidersHorizontal,
  Smartphone, Smile, Sparkles, Star, Sun, Tag, Trash2, Type, Upload, User, Wand2, X, Zap,
};

// Minimal 24×24 brand glyphs (stroke style to match Lucide).
const BRAND = {
  linkedin: [
    ['rect', { x: '3', y: '3', width: '18', height: '18', rx: '4' }],
    ['path', { d: 'M8 10.5V16M8 7.8v.1M11.5 16v-3.2c0-1.5 1-2.3 2.1-2.3s2 .8 2 2.3V16M11.5 10.5V16' }],
  ],
  instagram: [
    ['rect', { x: '3', y: '3', width: '18', height: '18', rx: '5' }],
    ['circle', { cx: '12', cy: '12', r: '4' }],
    ['path', { d: 'M17.3 6.7h.01' }],
  ],
  github: [
    ['path', { d: 'M9 19c-4 1.3-4-2-6-2.5M15 21v-3.4a3 3 0 0 0-.8-2.3c2.7-.3 5.6-1.3 5.6-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6.6 2.6 5.6 2.9 5.6 2.9a4.3 4.3 0 0 0-.1 3.2 4.6 4.6 0 0 0-1.3 3.2c0 4.6 2.9 5.7 5.6 6a3 3 0 0 0-.8 2.3V21' }],
  ],
  x: [['path', { d: 'M4 4l16 16M20 4L4 20' }]],
  youtube: [
    ['rect', { x: '2.5', y: '5.5', width: '19', height: '13', rx: '4' }],
    ['path', { d: 'M10 9.5v5l4.5-2.5z' }],
  ],
  facebook: [['path', { d: 'M14 8h2.5V4.5H14A3.5 3.5 0 0 0 10.5 8v2.5H8V14h2.5v6.5H14V14h2.5l.5-3.5h-3V8.6c0-.3.3-.6.6-.6z' }]],
  tiktok: [['path', { d: 'M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.5 2.6 2.2 4.2 5 4.5' }]],
  telegram: [['path', { d: 'M21 4 3 11l6 2.5M21 4l-3 16-9-6.5M21 4 9 13.5V19l3-3.5' }]],
  whatsapp: [
    ['path', { d: 'M3.5 20.5l1.3-4A8.5 8.5 0 1 1 8 19.6z' }],
    ['path', { d: 'M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .9c-1-.4-2.4-1.8-2.8-2.8l.9-1-1-2z' }],
  ],
  other: [['path', { d: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1' }]],
};

/**
 * @param {string} name Lucide PascalCase name or brand key (linkedin, whatsapp…)
 * @param {{size?:number, label?:string, class?:string, stroke?:number}} opts
 */
export function icon(name, opts = {}) {
  const node = LUCIDE[name] || BRAND[name] || LUCIDE.Info;
  const size = opts.size ?? 20;
  const el = createElement(node, {
    width: size,
    height: size,
    'stroke-width': opts.stroke ?? 1.75,
    class: ['icon', opts.class].filter(Boolean).join(' '),
  });
  if (opts.label) {
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', opts.label);
  } else {
    el.setAttribute('aria-hidden', 'true');
  }
  el.setAttribute('focusable', 'false');
  return el;
}
