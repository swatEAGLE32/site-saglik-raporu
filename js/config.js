const SB_URL = window._env?.SUPABASE_URL || "https://your-project.supabase.co";
const SB_KEY = window._env?.SUPABASE_ANON_KEY || "your-anon-key";
var supabase = window.supabase ? window.supabase.createClient(SB_URL, SB_KEY) : null;

// Global State
var D = null;
var openIdx = null;
var currentMode = 'single';
var currentUser = null;

// Helpers
window.pC = p => p >= 80 ? 'var(--green)' : p >= 60 ? 'var(--yellow)' : 'var(--red)';
window.pCl = p => p >= 80 ? 'g' : p >= 60 ? 'm' : 'b';
window.pLb = p => p >= 80 ? 'İYİ' : p >= 60 ? 'ORTA' : 'KRİTİK';
window.mvCl = s => s === 'iyi' ? 'mvg' : s === 'orta' ? 'mvm' : 'mvb';
window.scCl = p => p >= 80 ? 'scg' : p >= 60 ? 'scm' : 'scb';
