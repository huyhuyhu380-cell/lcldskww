// =====================================================================
// PHẦN 1/8: IMPORTS, CONFIG, STATE, STATS
// =====================================================================
// AI Tài Xỉu V11.0 - Pattern Frequency Weighting Edition
// =====================================================================
import fastify from "fastify";
import cors from "@fastify/cors";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import fetch from "node-fetch";

const PORT = 3000;
const FETCH_INTERVAL = 5000;
const MAX_HISTORY = 500;

const API_URL_MD5 = "https://wtxmd52.tele68.com/v1/txmd5/sessions";
const API_URL_HU = "https://wtx.tele68.com/v1/tx/lite-sessions?cp=R&cl=R&pf=web&at=62385f65eb49fcb34c72a7d6489ad91d";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TABLES = {
    md5: { name: "MD5", apiUrl: API_URL_MD5, history: [], currentSessionId: null, manager: null },
    hu:  { name: "HŨ",  apiUrl: API_URL_HU,  history: [], currentSessionId: null, manager: null }
};

const STATS = {
    STREAK_BREAK_PROB: {
        3: 0.32, 4: 0.42, 5: 0.55, 6: 0.65,
        7: 0.74, 8: 0.82, 9: 0.88, 10: 0.93,
        11: 0.96, 12: 0.98, 13: 0.99, 14: 0.995, 15: 0.999
    },
    HIGH_SCORE_THRESHOLD: 12,
    LOW_SCORE_THRESHOLD: 9,
    AVG_SCORE: 10.52,
    MIN_CONFIDENCE_TO_PREDICT: 0.62,
    STRONG_CONFIDENCE: 0.72,
    VERY_STRONG_CONFIDENCE: 0.80,
    MIN_ACCURACY_TO_VOTE: 0.35,
    HIGH_ACCURACY_BOOST: 0.65
};

// =====================================================================
// BẢNG TRỌNG SỐ MẪU CẦU (từ phân tích 5,284 phiên thực)
// =====================================================================
const PATTERN_WEIGHTS = {
    // ===== NHÓM 1: XEN KẼ (phổ biến nhất) =====
    '1_1_pattern': 1.00,
    '2_2_pattern': 1.00,
    '3_3_pattern': 0.85,
    '4_4_pattern': 0.55,
    '5_5_pattern': 0.30,
    '6_6_pattern': 0.25,

    // ===== NHÓM 2: 5 NHỊP =====
    '1_2_1_pattern': 0.80,
    '2_1_2_pattern': 0.80,
    '3_2_3_pattern': 0.70,
    '2_3_2_pattern': 0.70,
    '4_2_4_pattern': 0.40,
    '1_3_1_pattern': 0.60,
    '3_1_3_pattern': 0.60,
    '1_4_1_pattern': 0.35,
    '4_1_4_pattern': 0.25,
    '2_2_1_pattern': 0.50,
    '1_1_2_pattern': 0.50,
    '1_2_2_pattern': 0.45,
    '2_1_1_pattern': 0.45,
    '3_3_1_pattern': 0.35,
    '1_1_3_pattern': 0.35,
    '2_2_2_1_1_pattern': 0.20,
    '1_1_2_2_2_pattern': 0.20,
    '3_1_1_3_1_pattern': 0.10,
    'zigzag_12212_pattern': 0.25,
    'zigzag_21121_pattern': 0.25,
    'spike_13313_pattern': 0.08,
    'spike_31131_pattern': 0.08,
    'spike_14414_pattern': 0.05,
    'spike_41141_pattern': 0.05,
    'mirror_12221_pattern': 0.30,
    'mirror_21112_pattern': 0.25,
    'mirror_23332_pattern': 0.15,
    'mirror_32223_pattern': 0.15,
    'mirror_12321_pattern': 0.30,
    'mirror_32123_pattern': 0.25,
    'mirror_13431_pattern': 0.05,
    'mirror_43134_pattern': 0.05,
    'alternating_21212_pattern': 0.55,
    'alternating_12121_pattern': 0.55,
    'alternating_31313_pattern': 0.30,
    'alternating_13131_pattern': 0.35,
    'alternating_41414_pattern': 0.10,
    'alternating_14141_pattern': 0.15,

    // ===== NHÓM 3: 6 NHỊP =====
    '1_2_1_2_1_2_pattern': 0.50,
    '2_1_2_1_2_1_pattern': 0.50,
    '2_2_1_loop_pattern': 0.45,
    '1_1_2_loop_pattern': 0.45,
    '3_2_2_loop_pattern': 0.15,
    '1_3_3_loop_pattern': 0.10,
    'repeat_123123_pattern': 0.10,
    'repeat_321321_pattern': 0.10,
    'repeat_231231_pattern': 0.08,
    'repeat_312312_pattern': 0.08,
    'repeat_132132_pattern': 0.05,
    'repeat_213213_pattern': 0.05,
    'block_111_222_pattern': 0.15,
    'block_222_111_pattern': 0.15,
    'block_112222_pattern': 0.10,
    'block_221111_pattern': 0.10,
    'block_111122_pattern': 0.08,
    'block_222211_pattern': 0.08,
    'perfect_alternate_121212_pattern': 0.20,
    'perfect_alternate_212121_pattern': 0.20,
    'perfect_alternate_131313_pattern': 0.08,
    'perfect_alternate_313131_pattern': 0.08,
    'loop_221122_pattern': 0.40,
    'loop_112211_pattern': 0.40,
    'loop_221221_pattern': 0.30,
    'loop_112112_pattern': 0.30,

    // ===== NHÓM 4: 7 NHỊP =====
    'fibonacci_pattern': 0.15,
    'reverse_fibonacci_pattern': 0.15,
    'growth_pattern': 0.12,
    '2_2_2_3_loop_pattern': 0.08,
    'alternate_7_1212121_pattern': 0.06,
    'alternate_7_2121212_pattern': 0.06,
    'alternate_7_1313131_pattern': 0.04,
    'alternate_7_3131313_pattern': 0.04,
    'pyramid_7_pattern': 0.05,
    'pyramid_7b_pattern': 0.05,
    'wave_7_pattern': 0.06,
    'wave_7b_pattern': 0.06,

    // ===== NHÓM 5: 8 NHỊP =====
    '1122_loop_pattern': 0.40,
    '2211_loop_pattern': 0.40,
    '112_repeat_pattern': 0.25,
    '221_repeat_pattern': 0.25,
    'perfect_alternate_8_pattern': 0.05,
    'perfect_alternate_8b_pattern': 0.05,
    'repeat_4_step_up_pattern': 0.03,
    'repeat_4_step_down_pattern': 0.03,
    'symmetric_pyramid_8_pattern': 0.03,
    'block_4_4_pattern': 0.08,
    'block_4_4b_pattern': 0.08,

    // ===== NHÓM 6: 9-10 NHỊP =====
    'perfect_alternate_9_pattern': 0.03,
    'perfect_alternate_9b_pattern': 0.03,
    'pyramid_9_pattern': 0.02,
    'pyramid_9b_pattern': 0.02,
    'perfect_alternate_10_pattern': 0.02,
    'perfect_alternate_10b_pattern': 0.02,

    // ===== NHÓM 7: CẦU BỆT =====
    'ultra_long_run_pattern': 0.95,
    'hyper_long_run_pattern': 0.90,
    'mega_long_run_pattern': 0.85,
    'super_long_run_pattern': 0.80,
    'very_long_run_pattern': 0.75,
    'long_run_pattern': 0.70,
    'medium_long_run_pattern': 0.90,
    'medium_run_pattern': 0.95,
    'short_run_pattern': 1.00,

    // ===== NHÓM 8: GÃY KHÚC =====
    'broken_2_1_3_2_pattern': 0.30,
    'broken_3_1_2_3_pattern': 0.30,
    'broken_2_3_1_2_pattern': 0.25,
    'broken_1_3_2_1_pattern': 0.25,
    'broken_4_1_2_4_pattern': 0.10,
    'broken_1_4_2_1_pattern': 0.10,
    'broken_1_3_2_3_pattern': 0.20,
    'broken_3_2_1_2_pattern': 0.20,
    'broken_2_1_4_2_pattern': 0.05,
    'broken_4_2_1_4_pattern': 0.05,
    'broken_2_4_1_2_pattern': 0.05,

    // ===== NHÓM 9: ĐỐI XỨNG =====
    'mirror_pattern_12321': 0.30,
    'alternating_mirror_pattern': 0.25,
    'mirror_pattern_12221': 0.25,
    'mirror_pattern_32123': 0.25,
    'mirror_21212_pattern': 0.30,
    'mirror_31313_pattern': 0.20,
    'mirror_43234_pattern': 0.05,
    'mirror_23432_pattern': 0.05,

    // ===== NHÓM 10: 3 TẦNG =====
    'staircase_up_pattern': 0.25,
    'staircase_down_pattern': 0.25,
    'pyramid_pattern': 0.20,
    'inverted_pyramid_pattern': 0.20,
    'staircase_112233_pattern': 0.15,
    'staircase_332211_pattern': 0.15,
    'jump_staircase_pattern': 0.08,
    'jump_staircase_b_pattern': 0.08,

    // ===== NHÓM 11: NGẮN CÓ NHỊP =====
    '2_2_2_1_pattern': 0.40,
    '2_2_1_2_pattern': 0.40,
    '2_1_2_2_pattern': 0.40,
    '1_2_2_2_pattern': 0.40,
    '3_3_3_1_pattern': 0.20,
    '1_3_3_3_pattern': 0.20,
    'short_mirror_1221': 0.35,
    'short_mirror_2112': 0.35,
    'short_mirror_1331': 0.15,
    'short_mirror_3113': 0.15,
    'short_mirror_1441': 0.08,
    'short_mirror_4114': 0.08,
    'short_alternate_1212': 0.45,
    'short_alternate_2121': 0.45,
    'short_alternate_1313': 0.20,
    'short_alternate_3131': 0.20,
    'spike_1222': 0.30,
    'spike_2111': 0.30,
    'spike_2221': 0.30,
    'spike_1112': 0.30,

    // ===== NHÓM 12: ĐẶC BIỆT =====
    'detected_symmetry_pattern': 0.40,
    'detected_alternating_pattern': 0.45,
    'detected_wave_pattern': 0.35,
    'flip_streak_pattern': 0.50,
    'same_score_streak_pattern': 0.30,

    // ===== NHÓM 13: TRIPLE =====
    'triple_1_pattern': 0.20,
    'triple_2_pattern': 0.20,
    'triple_3_pattern': 0.20,
    'triple_4_pattern': 0.20,

    'random_pattern': 0.10
};

function getPatternWeight(patternType) {
    if (!patternType) return 0.10;
    return PATTERN_WEIGHTS[patternType] || 0.10;
}
// =====================================================================
// PHẦN 2/8: UTILITIES & PARSERS
// =====================================================================
function parseMd5Data(data) {
    if (!data || !Array.isArray(data.list)) return [];
    const sortedList = [...data.list].sort((a, b) => a.id - b.id);
    return sortedList.map(item => ({
        session: item.id, dice: item.dices, total: item.point,
        result: item.resultTruyenThong, tx: item.point >= 11 ? 'T' : 'X'
    }));
}

function parseHuData(data) {
    if (!data || !Array.isArray(data.list)) return [];
    const sortedList = [...data.list].sort((a, b) => a.id - b.id);
    return sortedList.map(item => ({
        session: item.id, dice: item.dices, total: item.point,
        result: item.resultTruyenThong, tx: item.point >= 11 ? 'T' : 'X'
    }));
}

function lastN(arr, n) { return arr.slice(Math.max(0, arr.length - n)); }
function sum(nums) { return nums.reduce((a, b) => a + b, 0); }
function avg(nums) { return nums.length ? sum(nums) / nums.length : 0; }

function entropy(arr) {
    if (!arr.length) return 0;
    const freq = {};
    for (const v of arr) freq[v] = (freq[v] || 0) + 1;
    let e = 0, n = arr.length;
    for (const k in freq) { const p = freq[k] / n; e -= p * Math.log2(p); }
    return e;
}

function similarity(a, b) {
    if (a.length !== b.length) return 0;
    let m = 0;
    for (let i = 0; i < a.length; i++) if (a[i] === b[i]) m++;
    return m / a.length;
}

function stdDev(nums) {
    if (nums.length < 2) return 0;
    const mean = avg(nums);
    return Math.sqrt(avg(nums.map(n => Math.pow(n - mean, 2))));
}

function checkSymmetry(arr) {
    if (arr.length < 3) return false;
    const len = arr.length;
    for (let i = 0; i < Math.floor(len / 2); i++) {
        if (arr[i] !== arr[len - 1 - i]) return false;
    }
    return true;
}

function checkAlternating(arr) {
    if (arr.length < 4) return false;
    let increasing = null;
    for (let i = 0; i < arr.length - 1; i++) {
        const diff = arr[i+1] - arr[i];
        if (diff === 0) return false;
        const isInc = diff > 0;
        if (increasing === null) increasing = isInc;
        else if (increasing === isInc) return false;
    }
    return true;
}

function checkWave(arr) {
    if (arr.length < 4) return false;
    let increasing = null;
    for (let i = 0; i < arr.length - 1; i++) {
        const diff = arr[i+1] - arr[i];
        if (Math.abs(diff) > 2) return false;
        const isInc = diff > 0;
        if (increasing === null) increasing = isInc;
        else if (increasing === isInc) return false;
    }
    return true;
}
// =====================================================================
// PHẦN 3/8: FEATURE EXTRACTION
// =====================================================================
function extractFeatures(history) {
    if (!history || history.length === 0) return {};
    const tx = history.map(h => h.tx);
    const totals = history.map(h => h.total);

    const freq = {};
    for (const v of tx) freq[v] = (freq[v] || 0) + 1;

    let runs = [], cur = tx[0], len = 1;
    for (let i = 1; i < tx.length; i++) {
        if (tx[i] === cur) len++;
        else { runs.push({ val: cur, len }); cur = tx[i]; len = 1; }
    }
    if (tx.length) runs.push({ val: cur, len });

    const meanTotal = avg(totals);
    const variance = avg(totals.map(t => Math.pow(t - meanTotal, 2)));
    const volatility = Math.sqrt(variance);

    const mean5 = avg(totals.slice(-5));
    const mean10 = avg(totals.slice(-10));
    const mean20 = avg(totals.slice(-20));
    const mean30 = avg(totals.slice(-30));
    const mean50 = avg(totals.slice(-50));

    let tStreak = 0, xStreak = 0;
    for (let i = tx.length - 1; i >= 0; i--) {
        if (tx[i] === 'T') tStreak++; else break;
    }
    for (let i = tx.length - 1; i >= 0; i--) {
        if (tx[i] === 'X') xStreak++; else break;
    }

    const recent10Totals = totals.slice(-10);
    const recent20Totals = totals.slice(-20);
    const recent50Totals = totals.slice(-50);

    const highCount10 = recent10Totals.filter(t => t >= 11).length;
    const lowCount10 = recent10Totals.filter(t => t <= 10).length;
    const highCount20 = recent20Totals.filter(t => t >= 11).length;
    const lowCount20 = recent20Totals.filter(t => t <= 10).length;

    let sameScoreStreak = 1;
    for (let i = totals.length - 1; i > 0; i--) {
        if (totals[i] === totals[i-1]) sameScoreStreak++; else break;
    }

    const recent50Tx = tx.slice(-50);
    let tToT = 0, tToX = 0, xToT = 0, xToX = 0;
    for (let i = 1; i < recent50Tx.length; i++) {
        if (recent50Tx[i-1] === 'T') {
            if (recent50Tx[i] === 'T') tToT++; else tToX++;
        } else {
            if (recent50Tx[i] === 'T') xToT++; else xToX++;
        }
    }

    const last5Tx = tx.slice(-5);
    const last10Tx = tx.slice(-10);
    const tCount5 = last5Tx.filter(t => t === 'T').length;
    const tCount10 = last10Tx.filter(t => t === 'T').length;

    const patternCounts = {};
    for (let i = 0; i < tx.length - 2; i++) {
        const pattern = tx.slice(i, i + 3).join('');
        patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
    }

    const recentRuns = runs.slice(-10);
    const avgRunLen = avg(recentRuns.map(r => r.len));
    const maxRunLen = recentRuns.length ? Math.max(...recentRuns.map(r => r.len)) : 0;

    const txRatios = {};
    for (const w of [5, 10, 20, 50]) {
        const window = tx.slice(-w);
        if (window.length > 0) {
            txRatios[w] = window.filter(t => t === 'T').length / window.length;
        }
    }

    const transitions = { TT: 0, TX: 0, XT: 0, XX: 0 };
    for (let i = 1; i < tx.length; i++) {
        const key = tx[i-1] + tx[i];
        transitions[key]++;
    }

    const runLengths = runs.map(r => r.len);
    const last5RunLens = runLengths.slice(-5);
    const isSymmetry = checkSymmetry(last5RunLens);
    const isAlternating = checkAlternating(last5RunLens);
    const isWave = checkWave(last5RunLens);

    const tCount20 = tx.slice(-20).filter(t => t === 'T').length;
    const xCount20 = tx.slice(-20).filter(t => t === 'X').length;
    const tCount30 = tx.slice(-30).filter(t => t === 'T').length;
    const xCount30 = tx.slice(-30).filter(t => t === 'X').length;

    let flipStreak = 0;
    for (let i = tx.length - 1; i > 0; i--) {
        if (tx[i] !== tx[i-1]) flipStreak++;
        else break;
    }

    return {
        tx, totals, freq, runs,
        maxRun: runs.reduce((m, r) => Math.max(m, r.len), 0),
        avgRunLength: avg(runs.map(r => r.len)),
        meanTotal, stdTotal: volatility, volatility,
        entropy: entropy(tx),
        last3Pattern: tx.slice(-3).join(''),
        last5Pattern: tx.slice(-5).join(''),
        last8Pattern: tx.slice(-8).join(''),
        last10Pattern: tx.slice(-10).join(''),
        last12Pattern: tx.slice(-12).join(''),
        last15Pattern: tx.slice(-15).join(''),
        last20Pattern: tx.slice(-20).join(''),
        mean5, mean10, mean20, mean30, mean50,
        tStreak, xStreak,
        highCount10, lowCount10, highCount20, lowCount20,
        sameScoreStreak,
        tToT, tToX, xToT, xToX,
        momentum5to10: tCount5 * 2 - tCount10,
        patternCounts, avgRunLen, maxRunLen,
        txRatios, transitions,
        lastRun: runs[runs.length - 1],
        prevRun: runs[runs.length - 2],
        prev2Run: runs[runs.length - 3],
        recent10Totals, recent20Totals, recent50Totals,
        runLengths, last5RunLens,
        isSymmetry, isAlternating, isWave,
        tCount20, xCount20, tCount30, xCount30,
        flipStreak
    };
}
// =====================================================================
// PHẦN 4/8: PATTERN DETECTION (120+ PATTERNS - ĐẦY ĐỦ)
// =====================================================================
function detectPatternType(runs, features = null) {
    if (!runs || runs.length < 3) return null;
    const lastRuns = runs.slice(-15);
    const lengths = lastRuns.map(r => r.len);
    const values = lastRuns.map(r => r.val);

    // NHÓM 1: XEN KẼ ĐƠN GIẢN
    if (lengths.length >= 5 && lengths.slice(-5).every(l => l === 1)) {
        const vals = values.slice(-6);
        if (vals.every((v, i) => i === 0 || v !== vals[i-1])) return '1_1_pattern';
    }
    if (lengths.length >= 4 && lengths.slice(-4).every(l => l === 2)) {
        const vals = values.slice(-5);
        if (vals.every((v, i) => i === 0 || v !== vals[i-1])) return '2_2_pattern';
    }
    if (lengths.length >= 3 && lengths.slice(-3).every(l => l === 3)) {
        const vals = values.slice(-4);
        if (vals.every((v, i) => i === 0 || v !== vals[i-1])) return '3_3_pattern';
    }
    if (lengths.length >= 3 && lengths.slice(-3).every(l => l === 4)) {
        const vals = values.slice(-4);
        if (vals.every((v, i) => i === 0 || v !== vals[i-1])) return '4_4_pattern';
    }
    if (lengths.length >= 2 && lengths.slice(-2).every(l => l === 5)) return '5_5_pattern';
    if (lengths.length >= 2 && lengths.slice(-2).every(l => l === 6)) return '6_6_pattern';

    // NHÓM 2: 5 NHỊP
    if (lengths.length >= 5) {
        const t = lengths.slice(-5);
        if (t[0]===1 && t[1]===2 && t[2]===1 && t[3]===2 && t[4]===1) return '1_2_1_pattern';
        if (t[0]===2 && t[1]===1 && t[2]===2 && t[3]===1 && t[4]===2) return '2_1_2_pattern';
        if (t[0]===3 && t[1]===2 && t[2]===3 && t[3]===2 && t[4]===3) return '3_2_3_pattern';
        if (t[0]===2 && t[1]===3 && t[2]===2 && t[3]===3 && t[4]===2) return '2_3_2_pattern';
        if (t[0]===4 && t[1]===2 && t[2]===4 && t[3]===2 && t[4]===4) return '4_2_4_pattern';
        if (t[0]===1 && t[1]===3 && t[2]===1 && t[3]===3 && t[4]===1) return '1_3_1_pattern';
        if (t[0]===3 && t[1]===1 && t[2]===3 && t[3]===1 && t[4]===3) return '3_1_3_pattern';
        if (t[0]===1 && t[1]===4 && t[2]===1 && t[3]===4 && t[4]===1) return '1_4_1_pattern';
        if (t[0]===4 && t[1]===1 && t[2]===4 && t[3]===1 && t[4]===4) return '4_1_4_pattern';
        if (t[0]===2 && t[1]===2 && t[2]===1 && t[3]===2 && t[4]===2) return '2_2_1_pattern';
        if (t[0]===1 && t[1]===1 && t[2]===2 && t[3]===1 && t[4]===1) return '1_1_2_pattern';
        if (t[0]===1 && t[1]===2 && t[2]===2 && t[3]===1 && t[4]===2) return '1_2_2_pattern';
        if (t[0]===2 && t[1]===1 && t[2]===1 && t[3]===2 && t[4]===1) return '2_1_1_pattern';
        if (t[0]===3 && t[1]===3 && t[2]===1 && t[3]===3 && t[4]===3) return '3_3_1_pattern';
        if (t[0]===1 && t[1]===1 && t[2]===3 && t[3]===1 && t[4]===1) return '1_1_3_pattern';
        if (t[0]===2 && t[1]===2 && t[2]===2 && t[3]===1 && t[4]===1) return '2_2_2_1_1_pattern';
        if (t[0]===1 && t[1]===1 && t[2]===2 && t[3]===2 && t[4]===2) return '1_1_2_2_2_pattern';
        if (t[0]===3 && t[1]===1 && t[2]===1 && t[3]===3 && t[4]===1) return '3_1_1_3_1_pattern';

        if (t.join('') === '12212') return 'zigzag_12212_pattern';
        if (t.join('') === '21121') return 'zigzag_21121_pattern';
        if (t.join('') === '13313') return 'spike_13313_pattern';
        if (t.join('') === '31131') return 'spike_31131_pattern';
        if (t.join('') === '14414') return 'spike_14414_pattern';
        if (t.join('') === '41141') return 'spike_41141_pattern';
        if (t.join('') === '12221') return 'mirror_12221_pattern';
        if (t.join('') === '21112') return 'mirror_21112_pattern';
        if (t.join('') === '23332') return 'mirror_23332_pattern';
        if (t.join('') === '32223') return 'mirror_32223_pattern';
        if (t.join('') === '12321') return 'mirror_12321_pattern';
        if (t.join('') === '32123') return 'mirror_32123_pattern';
        if (t.join('') === '13431') return 'mirror_13431_pattern';
        if (t.join('') === '43134') return 'mirror_43134_pattern';
        if (t.join('') === '21212') return 'alternating_21212_pattern';
        if (t.join('') === '12121') return 'alternating_12121_pattern';
        if (t.join('') === '31313') return 'alternating_31313_pattern';
        if (t.join('') === '13131') return 'alternating_13131_pattern';
        if (t.join('') === '41414') return 'alternating_41414_pattern';
        if (t.join('') === '14141') return 'alternating_14141_pattern';
    }

    // NHÓM 3: 6 NHỊP
    if (lengths.length >= 6) {
        const t = lengths.slice(-6);
        if (t[0]===1 && t[1]===2 && t[2]===1 && t[3]===2 && t[4]===1 && t[5]===2) return '1_2_1_2_1_2_pattern';
        if (t[0]===2 && t[1]===1 && t[2]===2 && t[3]===1 && t[4]===2 && t[5]===1) return '2_1_2_1_2_1_pattern';
        if (t[0]===2 && t[1]===2 && t[2]===1 && t[3]===2 && t[4]===2 && t[5]===1) return '2_2_1_loop_pattern';
        if (t[0]===1 && t[1]===1 && t[2]===2 && t[3]===1 && t[4]===1 && t[5]===2) return '1_1_2_loop_pattern';
        if (t[0]===3 && t[1]===2 && t[2]===2 && t[3]===3 && t[4]===2 && t[5]===2) return '3_2_2_loop_pattern';
        if (t[0]===1 && t[1]===3 && t[2]===3 && t[3]===1 && t[4]===3 && t[5]===3) return '1_3_3_loop_pattern';

        if (t.join('') === '123123') return 'repeat_123123_pattern';
        if (t.join('') === '321321') return 'repeat_321321_pattern';
        if (t.join('') === '231231') return 'repeat_231231_pattern';
        if (t.join('') === '312312') return 'repeat_312312_pattern';
        if (t.join('') === '132132') return 'repeat_132132_pattern';
        if (t.join('') === '213213') return 'repeat_213213_pattern';
        if (t.join('') === '111222') return 'block_111_222_pattern';
        if (t.join('') === '222111') return 'block_222_111_pattern';
        if (t.join('') === '112222') return 'block_112222_pattern';
        if (t.join('') === '221111') return 'block_221111_pattern';
        if (t.join('') === '111122') return 'block_111122_pattern';
        if (t.join('') === '222211') return 'block_222211_pattern';
        if (t.join('') === '121212') return 'perfect_alternate_121212_pattern';
        if (t.join('') === '212121') return 'perfect_alternate_212121_pattern';
        if (t.join('') === '131313') return 'perfect_alternate_131313_pattern';
        if (t.join('') === '313131') return 'perfect_alternate_313131_pattern';
        if (t.join('') === '221122') return 'loop_221122_pattern';
        if (t.join('') === '112211') return 'loop_112211_pattern';
        if (t.join('') === '221221') return 'loop_221221_pattern';
        if (t.join('') === '112112') return 'loop_112112_pattern';
    }

    // NHÓM 4: 7 NHỊP
    if (lengths.length >= 7) {
        const t = lengths.slice(-7);
        if (t[0]===1 && t[1]===2 && t[2]===3 && t[3]===1 && t[4]===2 && t[5]===3 && t[6]===1) return 'fibonacci_pattern';
        if (t[0]===3 && t[1]===2 && t[2]===1 && t[3]===3 && t[4]===2 && t[5]===1 && t[6]===3) return 'reverse_fibonacci_pattern';
        if (t[0]===1 && t[1]===1 && t[2]===2 && t[3]===3 && t[4]===1 && t[5]===1 && t[6]===2) return 'growth_pattern';
        if (t[0]===2 && t[1]===2 && t[2]===2 && t[3]===3 && t[4]===2 && t[5]===2 && t[6]===2) return '2_2_2_3_loop_pattern';
        if (t.join('') === '1212121') return 'alternate_7_1212121_pattern';
        if (t.join('') === '2121212') return 'alternate_7_2121212_pattern';
        if (t.join('') === '1313131') return 'alternate_7_1313131_pattern';
        if (t.join('') === '3131313') return 'alternate_7_3131313_pattern';
        if (t.join('') === '1234321') return 'pyramid_7_pattern';
        if (t.join('') === '3214123') return 'pyramid_7b_pattern';
        if (t.join('') === '1223221') return 'wave_7_pattern';
        if (t.join('') === '2112112') return 'wave_7b_pattern';
    }

    // NHÓM 5: 8 NHỊP
    if (lengths.length >= 8) {
        const t = lengths.slice(-8);
        if (t.join('') === '11221122') return '1122_loop_pattern';
        if (t.join('') === '22112211') return '2211_loop_pattern';
        if (t.join('') === '11211211') return '112_repeat_pattern';
        if (t.join('') === '22122122') return '221_repeat_pattern';
        if (t.join('') === '12121212') return 'perfect_alternate_8_pattern';
        if (t.join('') === '21212121') return 'perfect_alternate_8b_pattern';
        if (t.join('') === '12341234') return 'repeat_4_step_up_pattern';
        if (t.join('') === '43214321') return 'repeat_4_step_down_pattern';
        if (t.join('') === '12344321') return 'symmetric_pyramid_8_pattern';
        if (t.join('') === '11112222') return 'block_4_4_pattern';
        if (t.join('') === '22221111') return 'block_4_4b_pattern';
    }

    // NHÓM 6: 9-10 NHỊP
    if (lengths.length >= 9) {
        const t = lengths.slice(-9);
        if (t.join('') === '121212121') return 'perfect_alternate_9_pattern';
        if (t.join('') === '212121212') return 'perfect_alternate_9b_pattern';
        if (t.join('') === '123432123') return 'pyramid_9_pattern';
        if (t.join('') === '321412312') return 'pyramid_9b_pattern';
    }
    if (lengths.length >= 10) {
        const t = lengths.slice(-10);
        if (t.join('') === '1212121212') return 'perfect_alternate_10_pattern';
        if (t.join('') === '2121212121') return 'perfect_alternate_10b_pattern';
    }

    // NHÓM 7: CẦU BỆT
    const lastRun = lastRuns[lastRuns.length - 1];
    if (lastRun) {
        if (lastRun.len >= 15) return 'ultra_long_run_pattern';
        if (lastRun.len >= 13) return 'hyper_long_run_pattern';
        if (lastRun.len >= 12) return 'mega_long_run_pattern';
        if (lastRun.len >= 10) return 'super_long_run_pattern';
        if (lastRun.len >= 8) return 'very_long_run_pattern';
        if (lastRun.len >= 7) return 'long_run_pattern';
        if (lastRun.len >= 5) return 'medium_long_run_pattern';
        if (lastRun.len >= 4) return 'medium_run_pattern';
        if (lastRun.len >= 3) return 'short_run_pattern';
    }

    // NHÓM 8: GÃY KHÚC
    if (lengths.length >= 4) {
        const t = lengths.slice(-4);
        if (t[0]===2 && t[1]===1 && t[2]===3 && t[3]===2) return 'broken_2_1_3_2_pattern';
        if (t[0]===3 && t[1]===1 && t[2]===2 && t[3]===3) return 'broken_3_1_2_3_pattern';
        if (t[0]===2 && t[1]===3 && t[2]===1 && t[3]===2) return 'broken_2_3_1_2_pattern';
        if (t[0]===1 && t[1]===3 && t[2]===2 && t[3]===1) return 'broken_1_3_2_1_pattern';
        if (t[0]===4 && t[1]===1 && t[2]===2 && t[3]===4) return 'broken_4_1_2_4_pattern';
        if (t[0]===1 && t[1]===4 && t[2]===2 && t[3]===1) return 'broken_1_4_2_1_pattern';
        if (t[0]===1 && t[1]===3 && t[2]===2 && t[3]===3) return 'broken_1_3_2_3_pattern';
        if (t[0]===3 && t[1]===2 && t[2]===1 && t[3]===2) return 'broken_3_2_1_2_pattern';
        if (t[0]===2 && t[1]===1 && t[2]===4 && t[3]===2) return 'broken_2_1_4_2_pattern';
        if (t[0]===4 && t[1]===2 && t[2]===1 && t[3]===4) return 'broken_4_2_1_4_pattern';
        if (t[0]===2 && t[1]===4 && t[2]===1 && t[3]===2) return 'broken_2_4_1_2_pattern';
    }

    // NHÓM 9: ĐỐI XỨNG
    if (lengths.length >= 5) {
        const t = lengths.slice(-5);
        if (t[0]===1 && t[1]===2 && t[2]===3 && t[3]===2 && t[4]===1) return 'mirror_pattern_12321';
        if (t[0]===2 && t[1]===3 && t[2]===2 && t[3]===3 && t[4]===2) return 'alternating_mirror_pattern';
        if (t[0]===1 && t[1]===2 && t[2]===2 && t[3]===2 && t[4]===1) return 'mirror_pattern_12221';
        if (t[0]===3 && t[1]===2 && t[2]===1 && t[3]===2 && t[4]===3) return 'mirror_pattern_32123';
        if (t[0]===2 && t[1]===1 && t[2]===2 && t[3]===1 && t[4]===2) return 'mirror_21212_pattern';
        if (t[0]===3 && t[1]===1 && t[2]===3 && t[3]===1 && t[4]===3) return 'mirror_31313_pattern';
        if (t[0]===4 && t[1]===3 && t[2]===2 && t[3]===3 && t[4]===4) return 'mirror_43234_pattern';
        if (t[0]===2 && t[1]===3 && t[2]===4 && t[3]===3 && t[4]===2) return 'mirror_23432_pattern';
    }

    // NHÓM 10: 3 TẦNG
    if (lengths.length >= 6) {
        const t = lengths.slice(-6);
        if (t[0]===1 && t[1]===1 && t[2]===2 && t[3]===2 && t[4]===3 && t[5]===3) return 'staircase_up_pattern';
        if (t[0]===3 && t[1]===3 && t[2]===2 && t[3]===2 && t[4]===1 && t[5]===1) return 'staircase_down_pattern';
        if (t[0]===1 && t[1]===2 && t[2]===3 && t[3]===3 && t[4]===2 && t[5]===1) return 'pyramid_pattern';
        if (t[0]===3 && t[1]===2 && t[2]===1 && t[3]===1 && t[4]===2 && t[5]===3) return 'inverted_pyramid_pattern';
        if (t.join('') === '112233') return 'staircase_112233_pattern';
        if (t.join('') === '332211') return 'staircase_332211_pattern';
        if (t.join('') === '122331') return 'jump_staircase_pattern';
        if (t.join('') === '211332') return 'jump_staircase_b_pattern';
    }

    // NHÓM 11: NGẮN CÓ NHỊP
    if (lengths.length >= 4) {
        const t = lengths.slice(-4);
        if (t[0]===2 && t[1]===2 && t[2]===2 && t[3]===1) return '2_2_2_1_pattern';
        if (t[0]===2 && t[1]===2 && t[2]===1 && t[3]===2) return '2_2_1_2_pattern';
        if (t[0]===2 && t[1]===1 && t[2]===2 && t[3]===2) return '2_1_2_2_pattern';
        if (t[0]===1 && t[1]===2 && t[2]===2 && t[3]===2) return '1_2_2_2_pattern';
        if (t[0]===3 && t[1]===3 && t[2]===3 && t[3]===1) return '3_3_3_1_pattern';
        if (t[0]===1 && t[1]===3 && t[2]===3 && t[3]===3) return '1_3_3_3_pattern';
        if (t.join('') === '1221') return 'short_mirror_1221';
        if (t.join('') === '2112') return 'short_mirror_2112';
        if (t.join('') === '1331') return 'short_mirror_1331';
        if (t.join('') === '3113') return 'short_mirror_3113';
        if (t.join('') === '1441') return 'short_mirror_1441';
        if (t.join('') === '4114') return 'short_mirror_4114';
        if (t.join('') === '1212') return 'short_alternate_1212';
        if (t.join('') === '2121') return 'short_alternate_2121';
        if (t.join('') === '1313') return 'short_alternate_1313';
        if (t.join('') === '3131') return 'short_alternate_3131';
        if (t.join('') === '1222') return 'spike_1222';
        if (t.join('') === '2111') return 'spike_2111';
        if (t.join('') === '2221') return 'spike_2221';
        if (t.join('') === '1112') return 'spike_1112';
    }

    // NHÓM 12: ĐẶC BIỆT TỪ FEATURES
    if (features) {
        if (features.isSymmetry && lengths.length >= 5) return 'detected_symmetry_pattern';
        if (features.isAlternating && lengths.length >= 5) return 'detected_alternating_pattern';
        if (features.isWave && lengths.length >= 5) return 'detected_wave_pattern';
        if (features.flipStreak >= 5) return 'flip_streak_pattern';
        if (features.sameScoreStreak >= 3) return 'same_score_streak_pattern';
    }
    // NHÓM 13: TRIPLE
    if (lengths.length >= 3) {
        const last3 = lengths.slice(-3);
        if (last3.join('') === '111') return 'triple_1_pattern';
        if (last3.join('') === '222') return 'triple_2_pattern';
        if (last3.join('') === '333') return 'triple_3_pattern';
        if (last3.join('') === '444') return 'triple_4_pattern';
    }

    return 'random_pattern';
}

function predictNextFromPattern(patternType, runs, lastTx, history = null) {
    if (!patternType) return { pred: null, confidence: 0.5 };
    const lastRun = runs[runs.length - 1];
    if (!lastRun) return { pred: null, confidence: 0.5 };
    const flip = (v) => v === 'T' ? 'X' : 'T';
    const getStreakBreakConfidence = (streakLen) => {
        return STATS.STREAK_BREAK_PROB[Math.min(streakLen, 15)] || 0.999;
    };

    switch (patternType) {
        case '1_1_pattern': return { pred: flip(lastTx), confidence: 0.6 };
        case '2_2_pattern': return { pred: lastRun.len === 2 ? flip(lastRun.val) : lastRun.val, confidence: 0.58 };
        case '3_3_pattern': return { pred: lastRun.len === 3 ? flip(lastRun.val) : lastRun.val, confidence: 0.6 };
        case '4_4_pattern': return { pred: lastRun.len === 4 ? flip(lastRun.val) : lastRun.val, confidence: 0.62 };
        case '5_5_pattern': return { pred: lastRun.len === 5 ? flip(lastRun.val) : lastRun.val, confidence: 0.65 };
        case '6_6_pattern': return { pred: lastRun.len === 6 ? flip(lastRun.val) : lastRun.val, confidence: 0.68 };
        case '1_2_1_pattern':
            if (lastRun.len === 1) return { pred: flip(lastRun.val), confidence: 0.62 };
            if (lastRun.len === 2) return { pred: lastRun.val, confidence: 0.58 };
            return { pred: null, confidence: 0.5 };
        case '2_1_2_pattern':
            if (lastRun.len === 2) return { pred: flip(lastRun.val), confidence: 0.62 };
            if (lastRun.len === 1) return { pred: lastRun.val, confidence: 0.58 };
            return { pred: null, confidence: 0.5 };
        case '3_2_3_pattern':
            if (lastRun.len === 3) return { pred: flip(lastRun.val), confidence: 0.65 };
            if (lastRun.len === 2) return { pred: lastRun.val, confidence: 0.6 };
            return { pred: null, confidence: 0.5 };
        case '2_3_2_pattern':
            if (lastRun.len === 2) return { pred: flip(lastRun.val), confidence: 0.6 };
            if (lastRun.len === 3) return { pred: lastRun.val, confidence: 0.65 };
            return { pred: null, confidence: 0.5 };
        case '4_2_4_pattern':
            if (lastRun.len === 4) return { pred: flip(lastRun.val), confidence: 0.68 };
            if (lastRun.len === 2) return { pred: lastRun.val, confidence: 0.6 };
            return { pred: null, confidence: 0.5 };
        case '1_3_1_pattern':
            if (lastRun.len === 1) return { pred: flip(lastRun.val), confidence: 0.6 };
            if (lastRun.len === 3) return { pred: lastRun.val, confidence: 0.62 };
            return { pred: null, confidence: 0.5 };
        case '3_1_3_pattern':
            if (lastRun.len === 3) return { pred: flip(lastRun.val), confidence: 0.62 };
            if (lastRun.len === 1) return { pred: lastRun.val, confidence: 0.6 };
            return { pred: null, confidence: 0.5 };
        case '1_4_1_pattern':
            if (lastRun.len === 1) return { pred: flip(lastRun.val), confidence: 0.62 };
            if (lastRun.len === 4) return { pred: lastRun.val, confidence: 0.65 };
            return { pred: null, confidence: 0.5 };
        case '4_1_4_pattern':
            if (lastRun.len === 4) return { pred: flip(lastRun.val), confidence: 0.65 };
            if (lastRun.len === 1) return { pred: lastRun.val, confidence: 0.62 };
            return { pred: null, confidence: 0.5 };
        case '2_2_1_pattern':
            if (lastRun.len === 2) return { pred: flip(lastRun.val), confidence: 0.6 };
            return { pred: lastRun.val, confidence: 0.58 };
        case '1_1_2_pattern':
            if (lastRun.len === 1) return { pred: flip(lastRun.val), confidence: 0.6 };
            return { pred: lastRun.val, confidence: 0.58 };
        case '1_2_2_pattern':
            if (lastRun.len === 1) return { pred: flip(lastRun.val), confidence: 0.58 };
            return { pred: lastRun.val, confidence: 0.6 };
        case '2_1_1_pattern':
            if (lastRun.len === 2) return { pred: flip(lastRun.val), confidence: 0.58 };
            return { pred: lastRun.val, confidence: 0.6 };
        case '3_3_1_pattern':
            if (lastRun.len === 3) return { pred: flip(lastRun.val), confidence: 0.62 };
            return { pred: lastRun.val, confidence: 0.6 };
        case '1_1_3_pattern':
            if (lastRun.len === 1) return { pred: flip(lastRun.val), confidence: 0.6 };
            return { pred: lastRun.val, confidence: 0.62 };
        case '2_2_2_1_1_pattern':
            if (lastRun.len === 1) return { pred: flip(lastRun.val), confidence: 0.6 };
            if (lastRun.len === 2) return { pred: lastRun.val, confidence: 0.62 };
            return { pred: null, confidence: 0.5 };
        case '1_1_2_2_2_pattern':
            if (lastRun.len === 2) return { pred: flip(lastRun.val), confidence: 0.62 };
            if (lastRun.len === 1) return { pred: lastRun.val, confidence: 0.6 };
            return { pred: null, confidence: 0.5 };
        case '3_1_1_3_1_pattern':
            if (lastRun.len === 1) return { pred: flip(lastRun.val), confidence: 0.62 };
            if (lastRun.len === 3) return { pred: lastRun.val, confidence: 0.6 };
            return { pred: null, confidence: 0.5 };
        case 'zigzag_12212_pattern':
        case 'zigzag_21121_pattern':
            if (lastRun.len === 1) return { pred: flip(lastRun.val), confidence: 0.62 };
            if (lastRun.len === 2) return { pred: lastRun.val, confidence: 0.6 };
            return { pred: null, confidence: 0.5 };
        case 'spike_13313_pattern':
        case 'spike_31131_pattern':
            if (lastRun.len === 3) return { pred: flip(lastRun.val), confidence: 0.65 };
            if (lastRun.len === 1) return { pred: lastRun.val, confidence: 0.6 };
            return { pred: null, confidence: 0.5 };
        case 'spike_14414_pattern':
        case 'spike_41141_pattern':
            if (lastRun.len === 4) return { pred: flip(lastRun.val), confidence: 0.68 };
            if (lastRun.len === 1) return { pred: lastRun.val, confidence: 0.62 };
            return { pred: null, confidence: 0.5 };
        case 'mirror_12221_pattern':
        case 'mirror_21112_pattern':
        case 'mirror_23332_pattern':
        case 'mirror_32223_pattern':
        case 'mirror_12321_pattern':
        case 'mirror_32123_pattern':
        case 'mirror_13431_pattern':
        case 'mirror_43134_pattern':
            if (lastRun.len === 1) return { pred: flip(lastRun.val), confidence: 0.62 };
            if (lastRun.len === 2) return { pred: lastRun.val, confidence: 0.6 };
            if (lastRun.len === 3) return { pred: lastRun.val, confidence: 0.62 };
            return { pred: null, confidence: 0.5 };
        case 'alternating_21212_pattern':
        case 'alternating_12121_pattern':
        case 'alternating_31313_pattern':
        case 'alternating_13131_pattern':
        case 'alternating_41414_pattern':
        case 'alternating_14141_pattern':
            return { pred: lastRun.len === 1 ? flip(lastRun.val) : lastRun.val, confidence: 0.65 };
        case '1_2_1_2_1_2_pattern':
        case '2_1_2_1_2_1_pattern':
            return { pred: lastRun.len === 1 ? flip(lastRun.val) : lastRun.val, confidence: 0.65 };
        case '2_2_1_loop_pattern':
        case '1_1_2_loop_pattern':
        case '3_2_2_loop_pattern':
        case '1_3_3_loop_pattern':
            return { pred: lastRun.len === 2 ? flip(lastRun.val) : lastRun.val, confidence: 0.62 };
        case 'repeat_123123_pattern':
        case 'repeat_321321_pattern':
        case 'repeat_231231_pattern':
        case 'repeat_312312_pattern':
        case 'repeat_132132_pattern':
        case 'repeat_213213_pattern':
            return { pred: lastRun.len === 3 ? flip(lastRun.val) : lastRun.val, confidence: 0.65 };
        case 'block_111_222_pattern':
        case 'block_222_111_pattern':
        case 'block_112222_pattern':
        case 'block_221111_pattern':
        case 'block_111122_pattern':
        case 'block_222211_pattern':
            return { pred: lastRun.len === 3 ? flip(lastRun.val) : lastRun.val, confidence: 0.7 };
        case 'perfect_alternate_121212_pattern':
        case 'perfect_alternate_212121_pattern':
        case 'perfect_alternate_131313_pattern':
        case 'perfect_alternate_313131_pattern':
            return { pred: lastRun.len === 1 ? flip(lastRun.val) : lastRun.val, confidence: 0.7 };
        case 'loop_221122_pattern':
        case 'loop_112211_pattern':
        case 'loop_221221_pattern':
        case 'loop_112112_pattern':
            return { pred: lastRun.len === 2 ? flip(lastRun.val) : lastRun.val, confidence: 0.63 };
        case 'fibonacci_pattern':
            return { pred: lastRun.len === 1 ? lastRun.val : null, confidence: 0.6 };
        case 'reverse_fibonacci_pattern':
            return { pred: lastRun.len === 3 ? flip(lastRun.val) : lastRun.val, confidence: 0.6 };
        case 'growth_pattern':
            return { pred: lastRun.len === 2 ? flip(lastRun.val) : lastRun.val, confidence: 0.58 };
        case '2_2_2_3_loop_pattern':
            return { pred: lastRun.len === 2 ? lastRun.val : flip(lastRun.val), confidence: 0.6 };
        case 'alternate_7_1212121_pattern':
        case 'alternate_7_2121212_pattern':
        case 'alternate_7_1313131_pattern':
        case 'alternate_7_3131313_pattern':
            return { pred: lastRun.len === 1 ? flip(lastRun.val) : lastRun.val, confidence: 0.68 };
        case 'pyramid_7_pattern':
        case 'pyramid_7b_pattern':
        case 'wave_7_pattern':
        case 'wave_7b_pattern':
            return { pred: lastRun.len === 1 ? flip(lastRun.val) : lastRun.val, confidence: 0.62 };
        case '1122_loop_pattern':
        case '2211_loop_pattern':
            return { pred: lastRun.len === 2 ? flip(lastRun.val) : lastRun.val, confidence: 0.65 };
        case '112_repeat_pattern':
        case '221_repeat_pattern':
            return { pred: lastRun.len === 2 ? lastRun.val : flip(lastRun.val), confidence: 0.62 };
        case 'perfect_alternate_8_pattern':
        case 'perfect_alternate_8b_pattern':
            return { pred: lastRun.len === 1 ? flip(lastRun.val) : lastRun.val, confidence: 0.72 };
        case 'repeat_4_step_up_pattern':
        case 'repeat_4_step_down_pattern':
            return { pred: lastRun.len === 4 ? flip(lastRun.val) : lastRun.val, confidence: 0.68 };
        case 'symmetric_pyramid_8_pattern':
            return { pred: lastRun.len === 1 ? flip(lastRun.val) : lastRun.val, confidence: 0.65 };
        case 'block_4_4_pattern':
        case 'block_4_4b_pattern':
            return { pred: lastRun.len === 4 ? flip(lastRun.val) : lastRun.val, confidence: 0.7 };
        case 'perfect_alternate_9_pattern':
        case 'perfect_alternate_9b_pattern':
            return { pred: lastRun.len === 1 ? flip(lastRun.val) : lastRun.val, confidence: 0.72 };
        case 'pyramid_9_pattern':
        case 'pyramid_9b_pattern':
            return { pred: lastRun.len === 1 ? flip(lastRun.val) : lastRun.val, confidence: 0.66 };
        case 'perfect_alternate_10_pattern':
        case 'perfect_alternate_10b_pattern':
            return { pred: lastRun.len === 1 ? flip(lastRun.val) : lastRun.val, confidence: 0.74 };
        case 'ultra_long_run_pattern':
            return { pred: flip(lastRun.val), confidence: 0.999 };
        case 'hyper_long_run_pattern':
            return { pred: flip(lastRun.val), confidence: 0.995 };
        case 'mega_long_run_pattern':
            return { pred: flip(lastRun.val), confidence: 0.98 };
        case 'super_long_run_pattern':
            return { pred: flip(lastRun.val), confidence: getStreakBreakConfidence(lastRun.len) };
        case 'very_long_run_pattern':
            return { pred: flip(lastRun.val), confidence: getStreakBreakConfidence(lastRun.len) };
        case 'long_run_pattern':
            return { pred: lastRun.len >= 8 ? flip(lastRun.val) : lastRun.val, confidence: 0.7 };
        case 'medium_long_run_pattern':
            return { pred: lastRun.val, confidence: 0.55 };
        case 'medium_run_pattern':
            return { pred: lastRun.val, confidence: 0.52 };
        case 'short_run_pattern':
            return { pred: flip(lastRun.val), confidence: 0.55 };
        case 'broken_2_1_3_2_pattern':
            if (lastRun.len === 2) return { pred: flip(lastRun.val), confidence: 0.6 };
            if (lastRun.len === 3) return { pred: lastRun.val, confidence: 0.62 };
            return { pred: null, confidence: 0.5 };
        case 'broken_3_1_2_3_pattern':
            if (lastRun.len === 3) return { pred: flip(lastRun.val), confidence: 0.62 };
            return { pred: lastRun.val, confidence: 0.58 };
        case 'broken_2_3_1_2_pattern':
            if (lastRun.len === 2) return { pred: flip(lastRun.val), confidence: 0.6 };
            if (lastRun.len === 1) return { pred: lastRun.val, confidence: 0.58 };
            return { pred: null, confidence: 0.5 };
        case 'broken_1_3_2_1_pattern':
            if (lastRun.len === 1) return { pred: flip(lastRun.val), confidence: 0.58 };
            if (lastRun.len === 2) return { pred: lastRun.val, confidence: 0.6 };
            return { pred: null, confidence: 0.5 };
        case 'broken_4_1_2_4_pattern':
        case 'broken_1_4_2_1_pattern':
        case 'broken_1_3_2_3_pattern':
        case 'broken_3_2_1_2_pattern':
        case 'broken_2_1_4_2_pattern':
        case 'broken_4_2_1_4_pattern':
        case 'broken_2_4_1_2_pattern':
            if (lastRun.len === 1) return { pred: flip(lastRun.val), confidence: 0.58 };
            if (lastRun.len === 2) return { pred: lastRun.val, confidence: 0.6 };
            if (lastRun.len === 3) return { pred: lastRun.val, confidence: 0.62 };
            return { pred: null, confidence: 0.5 };
        case 'mirror_pattern_12321':
        case 'alternating_mirror_pattern':
        case 'mirror_pattern_12221':
        case 'mirror_pattern_32123':
        case 'mirror_21212_pattern':
        case 'mirror_31313_pattern':
        case 'mirror_43234_pattern':
        case 'mirror_23432_pattern':
            if (lastRun.len === 1) return { pred: flip(lastRun.val), confidence: 0.62 };
            if (lastRun.len === 2) return { pred: lastRun.val, confidence: 0.6 };
            return { pred: null, confidence: 0.5 };
        case 'staircase_up_pattern':
        case 'staircase_down_pattern':
        case 'pyramid_pattern':
        case 'inverted_pyramid_pattern':
            if (lastRun.len === 3) return { pred: flip(lastRun.val), confidence: 0.6 };
            if (lastRun.len === 1) return { pred: lastRun.val, confidence: 0.58 };
            return { pred: null, confidence: 0.5 };
        case 'staircase_112233_pattern':
        case 'staircase_332211_pattern':
        case 'jump_staircase_pattern':
        case 'jump_staircase_b_pattern':
            if (lastRun.len === 3) return { pred: flip(lastRun.val), confidence: 0.62 };
            return { pred: lastRun.val, confidence: 0.58 };
        case '2_2_2_1_pattern':
        case '2_2_1_2_pattern':
        case '2_1_2_2_pattern':
        case '1_2_2_2_pattern':
        case '3_3_3_1_pattern':
        case '1_3_3_3_pattern':
            return { pred: lastRun.len === 1 ? lastRun.val : flip(lastRun.val), confidence: 0.58 };
        case 'short_mirror_1221':
        case 'short_mirror_2112':
        case 'short_mirror_1331':
        case 'short_mirror_3113':
        case 'short_mirror_1441':
        case 'short_mirror_4114':
            if (lastRun.len === 1) return { pred: flip(lastRun.val), confidence: 0.62 };
            if (lastRun.len === 2) return { pred: lastRun.val, confidence: 0.6 };
            return { pred: null, confidence: 0.5 };
        case 'short_alternate_1212':
        case 'short_alternate_2121':
        case 'short_alternate_1313':
        case 'short_alternate_3131':
            return { pred: lastRun.len === 1 ? flip(lastRun.val) : lastRun.val, confidence: 0.62 };
        case 'spike_1222':
        case 'spike_2111':
        case 'spike_2221':
        case 'spike_1112':
            return { pred: lastRun.len === 1 ? flip(lastRun.val) : lastRun.val, confidence: 0.58 };
        case 'detected_symmetry_pattern':
            return { pred: flip(lastTx), confidence: 0.6 };
        case 'detected_alternating_pattern':
            return { pred: flip(lastTx), confidence: 0.62 };
        case 'detected_wave_pattern':
            return { pred: flip(lastTx), confidence: 0.58 };
        case 'flip_streak_pattern':
            return { pred: lastTx, confidence: 0.6 };
        case 'same_score_streak_pattern':
            return { pred: flip(lastTx), confidence: 0.58 };
        case 'triple_1_pattern':
        case 'triple_2_pattern':
        case 'triple_3_pattern':
        case 'triple_4_pattern':
            return { pred: lastRun.len === 3 ? flip(lastRun.val) : lastRun.val, confidence: 0.62 };
        default: return { pred: null, confidence: 0.5 };
    }
}

// Hàm dự đoán có trọng số
function predictWithWeightedPattern(runs, tx, history) {
    const features = extractFeatures(history);
    const patternType = detectPatternType(runs, features);

    if (!patternType || patternType === 'random_pattern') {
        return { pred: null, confidence: 0, weight: 0, pattern: null };
    }

    const lastTx = tx[tx.length - 1];
    const result = predictNextFromPattern(patternType, runs, lastTx, history);
    const weight = getPatternWeight(patternType);

    if (!result.pred) {
        return { pred: null, confidence: 0, weight, pattern: patternType };
    }

    const adjustedConfidence = result.confidence * weight;
    return {
        pred: result.pred,
        confidence: adjustedConfidence,
        weight,
        pattern: patternType,
        originalConfidence: result.confidence
    };
}
// =====================================================================
// PHẦN 5/8: 24 THUẬT TOÁN
// =====================================================================

function algo5_freqRebalance(history) {
    if (history.length < 20) return null;
    const features = extractFeatures(history);
    const { freq, entropy: e } = features;
    const tCount = freq['T'] || 0;
    const xCount = freq['X'] || 0;
    const diff = Math.abs(tCount - xCount);
    const total = tCount + xCount;
    let threshold = e > 0.9 ? 0.45 : (e < 0.4 ? 0.65 : 0.55);
    const recent = history.slice(-30);
    const recentT = recent.filter(h => h.tx === 'T').length;
    const recentX = recent.filter(h => h.tx === 'X').length;
    const recentTotal = recentT + recentX;
    if (total > 0 && recentTotal > 0) {
        const combinedRatio = (diff / total) * 0.4 + (Math.abs(recentT - recentX) / recentTotal) * 0.6;
        if (combinedRatio > threshold) {
            if (recentT > recentX + 2) return 'X';
            if (recentX > recentT + 2) return 'T';
        }
    }
    return null;
}

function algoA_markov(history) {
    if (history.length < 15) return null;
    const tx = history.map(h => h.tx);
    let maxOrder = 5;
    if (history.length < 30) maxOrder = 3;
    if (history.length < 20) maxOrder = 2;
    let bestPred = null, bestScore = -1;
    for (let order = 2; order <= maxOrder; order++) {
        if (tx.length < order + 8) continue;
        const transitions = {};
        const totalTransitions = tx.length - order;
        const decayFactor = 0.95;
        for (let i = 0; i < totalTransitions; i++) {
            const key = tx.slice(i, i + order).join('');
            const next = tx[i + order];
            const weight = Math.pow(decayFactor, totalTransitions - i - 1);
            if (!transitions[key]) transitions[key] = { T: 0, X: 0 };
            transitions[key][next] += weight;
        }
        const lastKey = tx.slice(-order).join('');
        const counts = transitions[lastKey];
        if (counts && (counts.T + counts.X) > 0.5) {
            const total = counts.T + counts.X;
            const confidence = Math.abs(counts.T - counts.X) / total;
            const pred = counts.T > counts.X ? 'T' : 'X';
            const score = confidence * (order / maxOrder) * Math.min(1, total / 10);
            if (score > bestScore) { bestScore = score; bestPred = pred; }
        }
    }
    return bestPred;
}

function algoB_ngram(history) {
    if (history.length < 30) return null;
    const tx = history.map(h => h.tx);
    const ngramSizes = [7, 6, 5, 4, 3];
    let bestPred = null, bestConfidence = 0;
    for (const n of ngramSizes) {
        if (tx.length < n * 2) continue;
        const target = tx.slice(-n).join('');
        const matches = [];
        for (let i = 0; i <= tx.length - n - 1; i++) {
            if (tx.slice(i, i + n).join('') === target) {
                matches.push({ position: i, next: tx[i + n], distance: tx.length - i });
            }
        }
        if (matches.length >= 2) {
            const weights = { T: 0, X: 0 };
            let totalWeight = 0;
            for (const m of matches) {
                const w = 1 / (m.distance * 0.5 + 1);
                weights[m.next] += w;
                totalWeight += w;
            }
            if (totalWeight > 0) {
                const confidence = Math.abs(weights.T - weights.X) / totalWeight;
                if (confidence > bestConfidence) {
                    bestConfidence = confidence;
                    bestPred = weights.T > weights.X ? 'T' : 'X';
                }
            }
        }
    }
    return bestConfidence > 0.3 ? bestPred : null;
}

// V11.0: NeoPattern với trọng số
function algoS_NeoPattern(history) {
    if (history.length < 20) return null;
    const features = extractFeatures(history);
    const { runs, tx } = features;

    const result = predictWithWeightedPattern(runs, tx, history);

    if (!result.pred) return null;
    if (result.weight < 0.15) return null;
    if (result.confidence < 0.10) return null;

    if (result.weight >= 0.7 && result.originalConfidence >= 0.55) {
        return result.pred;
    }

    const recentRuns = runs.slice(-Math.min(8, runs.length));
    const consistency = recentRuns.length
        ? recentRuns.filter(r => r.len >= 1).length / recentRuns.length
        : 0;

    if (consistency > 0.6 && result.weight >= 0.30) return result.pred;
    return null;
}

function algoF_SuperDeepAnalysis(history) {
    if (history.length < 40) return null;
    const timeframes = [
        { lookback: 10, weight: 0.3 },
        { lookback: 20, weight: 0.3 },
        { lookback: 40, weight: 0.4 }
    ];
    let totalScore = { T: 0, X: 0 };
    let totalWeight = 0;
    for (const tf of timeframes) {
        if (history.length < tf.lookback) continue;
        const slice = history.slice(-tf.lookback);
        const sliceTx = slice.map(h => h.tx);
        const sliceTotals = slice.map(h => h.total);
        const tCount = sliceTx.filter(t => t === 'T').length;
        const xCount = sliceTx.filter(t => t === 'X').length;
        const meanTotal = avg(sliceTotals);
        const volatility = Math.sqrt(avg(sliceTotals.map(t => Math.pow(t - meanTotal, 2))));
        let tScore = 0, xScore = 0;
        if (meanTotal > 12) xScore += 0.4;
        if (meanTotal < 9) tScore += 0.4;
        if (tCount > xCount + 3) xScore += 0.3;
        if (xCount > tCount + 3) tScore += 0.3;
        if (volatility > 4) {
            if (sliceTx[sliceTx.length - 1] === 'T') tScore += 0.2;
            else xScore += 0.2;
        }
        const trend = sliceTotals[sliceTotals.length - 1] - sliceTotals[0];
        if (trend > 3) xScore += 0.1;
        if (trend < -3) tScore += 0.1;
        const w = tf.weight * (sliceTx.length / tf.lookback);
        totalScore.T += tScore * w;
        totalScore.X += xScore * w;
        totalWeight += w;
    }
    if (totalWeight > 0 && Math.abs(totalScore.T - totalScore.X) > 0.15) {
        return totalScore.T > totalScore.X ? 'T' : 'X';
    }
    return null;
}

function algoE_Transformer(history) {
    if (history.length < 80) return null;
    const tx = history.map(h => h.tx);
    const seqLengths = [5, 6, 8, 10, 12];
    let attentionScores = { T: 0, X: 0 };
    for (const seqLen of seqLengths) {
        if (tx.length < seqLen * 2) continue;
        const targetSeq = tx.slice(-seqLen).join('');
        let seqMatches = 0;
        for (let i = 0; i <= tx.length - seqLen - 1; i++) {
            const historySeq = tx.slice(i, i + seqLen).join('');
            const matchScore = similarity(historySeq, targetSeq);
            if (matchScore >= 0.65) {
                const nextResult = tx[i + seqLen];
                const recency = 1 / (tx.length - i);
                const lengthFactor = seqLen / 12;
                const w = matchScore * recency * lengthFactor;
                attentionScores[nextResult] += w;
                seqMatches++;
            }
        }
        if (seqMatches >= 3) {
            attentionScores.T *= 1.5;
            attentionScores.X *= 1.5;
        }
    }
    if (attentionScores.T + attentionScores.X > 0.2) {
        const total = attentionScores.T + attentionScores.X;
        const confidence = Math.abs(attentionScores.T - attentionScores.X) / total;
        if (confidence > 0.2) return attentionScores.T > attentionScores.X ? 'T' : 'X';
    }
    return null;
}

function algoG_SuperBridgePredictor(history) {
    const features = extractFeatures(history);
    const { runs } = features;
    if (runs.length < 4) return null;
    const lastRun = runs[runs.length - 1];
    let prediction = null, confidence = 0;

    if (lastRun.len >= 10) { prediction = lastRun.val === 'T' ? 'X' : 'T'; confidence = 0.9; }
    else if (lastRun.len >= 8) { prediction = lastRun.val === 'T' ? 'X' : 'T'; confidence = 0.8; }
    else if (lastRun.len >= 7) {
        const avgRun = avg(runs.map(r => r.len));
        if (lastRun.len > avgRun * 2) { prediction = lastRun.val === 'T' ? 'X' : 'T'; confidence = 0.75; }
        else { prediction = lastRun.val; confidence = 0.6; }
    }
    else if (lastRun.len >= 5 && lastRun.len <= 6) {
        const avgRun = avg(runs.map(r => r.len));
        if (lastRun.len > avgRun * 1.8) { prediction = lastRun.val === 'T' ? 'X' : 'T'; confidence = 0.7; }
        else { prediction = lastRun.val; confidence = 0.62; }
    }

    if (!prediction && runs.length >= 8) {
        const recentRuns = runs.slice(-8);
        const runLengths = recentRuns.map(r => r.len);
        const meanLength = avg(runLengths);
        const stdLength = stdDev(runLengths);
        if (lastRun.len > meanLength + stdLength * 1.5) {
            prediction = lastRun.val === 'T' ? 'X' : 'T';
            confidence = 0.6;
        }
    }
    return confidence > 0.55 ? prediction : null;
}

function algoH_AdaptiveMarkov(history) {
    if (history.length < 25) return null;
    const tx = history.map(h => h.tx);
    let ensembleVotes = { T: 0, X: 0 };
    for (const order of [2, 3, 4, 5]) {
        if (tx.length < order + 5) continue;
        const transitions = {};
        for (let i = 0; i <= tx.length - order - 1; i++) {
            const key = tx.slice(i, i + order).join('');
            const next = tx[i + order];
            if (!transitions[key]) transitions[key] = { T: 0, X: 0 };
            transitions[key][next]++;
        }
        const lastKey = tx.slice(-order).join('');
        const counts = transitions[lastKey];
        if (counts && counts.T + counts.X >= 2) {
            const pred = counts.T > counts.X ? 'T' : 'X';
            const conf = Math.abs(counts.T - counts.X) / (counts.T + counts.X);
            ensembleVotes[pred] += conf * (order / 10);
        }
    }
    for (const lookback of [10, 20, 30]) {
        if (tx.length < lookback) continue;
        const recent = tx.slice(-lookback);
        const tCount = recent.filter(t => t === 'T').length;
        const xCount = recent.filter(t => t === 'X').length;
        if (Math.abs(tCount - xCount) > lookback * 0.2) {
            const pred = tCount > xCount ? 'X' : 'T';
            const conf = Math.abs(tCount - xCount) / lookback;
            ensembleVotes[pred] += conf * 0.5;
        }
    }
    if (ensembleVotes.T + ensembleVotes.X > 0.3) {
        return ensembleVotes.T > ensembleVotes.X ? 'T' : 'X';
    }
    return null;
}

function algoI_PatternMaster(history) {
    if (history.length < 25) return null;
    const features = extractFeatures(history);
    const { runs, tx } = features;
    if (runs.length < 5) return null;
    const recentRuns = runs.slice(-Math.min(8, runs.length));
    const runLengths = recentRuns.map(r => r.len);
    const runValues = recentRuns.map(r => r.val);
    let patternStrength = { T: 0, X: 0 };
    const runPattern = runLengths.join('');
    const lastVal = runValues[runValues.length - 1];

    const patternLibrary = [
        { p: '12121', pred: lastVal === 'T' ? 'X' : 'T', s: 0.7 },
        { p: '21212', pred: lastVal, s: 0.7 },
        { p: '13131', pred: lastVal, s: 0.65 },
        { p: '31313', pred: lastVal === 'T' ? 'X' : 'T', s: 0.65 },
        { p: '14141', pred: lastVal === 'T' ? 'X' : 'T', s: 0.7 },
        { p: '41414', pred: lastVal, s: 0.7 },
        { p: '24242', pred: lastVal === 'T' ? 'X' : 'T', s: 0.65 },
        { p: '42424', pred: lastVal, s: 0.65 },
        { p: '121212', pred: lastVal === 'T' ? 'X' : 'T', s: 0.75 },
        { p: '212121', pred: lastVal === 'T' ? 'T' : 'X', s: 0.75 },
        { p: '221221', pred: lastVal === 'T' ? 'T' : 'X', s: 0.7 },
        { p: '112112', pred: lastVal === 'T' ? 'X' : 'T', s: 0.7 },
        { p: '1231231', pred: lastVal === 'T' ? 'T' : 'X', s: 0.72 },
        { p: '3213213', pred: lastVal === 'T' ? 'X' : 'T', s: 0.72 }
    ];
    for (const lib of patternLibrary) {
        if (runPattern.includes(lib.p)) patternStrength[lib.pred] += lib.s;
    }

    const last10Tx = tx.slice(-10).join('');
    const last12Tx = tx.slice(-12).join('');
    const txPatterns = [
        { p: 'TXTXTXTX', pred: 'X', s: 0.8 },
        { p: 'XTXTXTXT', pred: 'T', s: 0.8 },
        { p: 'TXTXTXTXTX', pred: 'X', s: 0.82 },
        { p: 'XTXTXTXTXT', pred: 'T', s: 0.82 },
        { p: 'TTXXTTXX', pred: 'X', s: 0.7 },
        { p: 'XXTTXXTT', pred: 'T', s: 0.7 },
        { p: 'TTTXXXTT', pred: 'T', s: 0.75 },
        { p: 'XXXTTTXX', pred: 'X', s: 0.75 },
        { p: 'TTXTTXTT', pred: 'X', s: 0.7 },
        { p: 'XXTXXTXX', pred: 'T', s: 0.7 },
        { p: 'TTTXXTTT', pred: 'T', s: 0.72 },
        { p: 'XXXTTXXX', pred: 'X', s: 0.72 },
        { p: 'TXXTXXT', pred: 'X', s: 0.68 },
        { p: 'XTTXTTX', pred: 'T', s: 0.68 }
    ];
    for (const p of txPatterns) {
        if (last10Tx.includes(p.p)) patternStrength[p.pred] += p.s;
        if (last12Tx.includes(p.p)) patternStrength[p.pred] += p.s * 0.3;
    }

    const lastRun = recentRuns[recentRuns.length - 1];
    if (lastRun) {
        const avgRecentLength = avg(runLengths);
        if (lastRun.len > avgRecentLength * 1.8) {
            patternStrength[lastRun.val === 'T' ? 'X' : 'T'] += 0.5;
        } else if (lastRun.len < avgRecentLength * 0.6) {
            patternStrength[lastRun.val] += 0.4;
        }
    }
    if (patternStrength.T + patternStrength.X > 0) {
        const total = patternStrength.T + patternStrength.X;
        const conf = Math.abs(patternStrength.T - patternStrength.X) / total;
        if (conf > 0.25) return patternStrength.T > patternStrength.X ? 'T' : 'X';
    }
    return null;
}

function algoJ_QuantumEntropy(history) {
    if (history.length < 30) return null;
    const features = extractFeatures(history);
    const { entropy: e, tx, runs } = features;
    let entropyPredictions = { T: 0, X: 0 };
    for (const window of [10, 20, 30]) {
        if (tx.length < window) continue;
        const windowTx = tx.slice(-window);
        const windowEntropy = entropy(windowTx);
        if (windowEntropy < 0.3) {
            entropyPredictions[windowTx[windowTx.length - 1]] += 0.6;
        } else if (windowEntropy > 0.9) {
            const tCount = windowTx.filter(t => t === 'T').length;
            const xCount = windowTx.filter(t => t === 'X').length;
            if (tCount > xCount) entropyPredictions['X'] += 0.5;
            else if (xCount > tCount) entropyPredictions['T'] += 0.5;
        } else {
            const recentRuns = runs.slice(-4);
            if (recentRuns.length >= 3) {
                const runLengths = recentRuns.map(r => r.len);
                if (Math.max(...runLengths) - Math.min(...runLengths) <= 2) {
                    entropyPredictions[tx[tx.length - 1]] += 0.4;
                }
            }
        }
    }
    if (e < 0.4) entropyPredictions[tx[tx.length - 1]] += 0.3;
    else if (e > 0.95) {
        const recentT = tx.slice(-20).filter(t => t === 'T').length;
        const recentX = tx.slice(-20).filter(t => t === 'X').length;
        if (recentT > recentX) entropyPredictions['X'] += 0.4;
        else if (recentX > recentT) entropyPredictions['T'] += 0.4;
    }
    if (entropyPredictions.T + entropyPredictions.X > 0.4) {
        return entropyPredictions.T > entropyPredictions.X ? 'T' : 'X';
    }
    return null;
}

function algoK_AntiStuckDetector(history, recentPredictions = []) {
    if (history.length < 15) return null;
    const features = extractFeatures(history);
    const { runs } = features;
    const lastRun = runs[runs.length - 1];
    if (!lastRun) return null;

    const last3Preds = recentPredictions.slice(-3);
    const last3Actual = history.slice(-3).map(h => h.tx);
    if (last3Preds.length === 3) {
        const samePred = last3Preds.every(p => p === last3Preds[0]);
        const allWrong = last3Preds.every((p, i) => p !== last3Actual[i]);
        if (samePred && allWrong) {
            return last3Preds[0] === 'T' ? 'X' : 'T';
        }
    }
    if (lastRun.len >= 6) {
        return lastRun.val === 'T' ? 'X' : 'T';
    }
    return null;
}

function algoL_MomentumReversal(history) {
    if (history.length < 30) return null;
    const totals = history.map(h => h.total);
    const mean5 = avg(totals.slice(-5));
    const mean20 = avg(totals.slice(-20));
    const last3 = totals.slice(-3);
    const last5 = totals.slice(-5);
    const trend3to5 = avg(last3) - avg(last5);
    if (mean5 > 12.5 && trend3to5 > 0.5) return 'X';
    if (mean5 < 8.5 && trend3to5 < -0.5) return 'T';
    if (mean5 > mean20 + 2) return 'X';
    if (mean5 < mean20 - 2) return 'T';
    return null;
}

function algoM_ScoreDistribution(history) {
    if (history.length < 20) return null;
    const totals = history.map(h => h.total);
    const recent20 = totals.slice(-20);
    const mean20 = avg(recent20);
    const highCount = recent20.filter(t => t >= 12).length;
    const lowCount = recent20.filter(t => t <= 9).length;
    const midCount = recent20.filter(t => t > 9 && t < 12).length;

    if (highCount >= 10 && mean20 > 12) return 'X';
    if (lowCount >= 10 && mean20 < 9) return 'T';
    if (midCount >= 12) {
        const last5 = recent20.slice(-5);
        const last5Mean = avg(last5);
        if (last5Mean > 10.5) return 'T';
        if (last5Mean < 10.5) return 'X';
    }
    return null;
}

function algoN_TransitionMatrix(history) {
    if (history.length < 30) return null;
    const tx = history.map(h => h.tx);
    const recent = tx.slice(-50);
    const transitions = { TT: 0, TX: 0, XT: 0, XX: 0 };
    for (let i = 1; i < recent.length; i++) {
        const key = recent[i-1] + recent[i];
        transitions[key]++;
    }
    const lastTx = recent[recent.length - 1];
    const totalFromLast = lastTx === 'T'
        ? transitions.TT + transitions.TX
        : transitions.XT + transitions.XX;
    if (totalFromLast < 5) return null;
    let probFlip;
    if (lastTx === 'T') probFlip = transitions.TX / totalFromLast;
    else probFlip = transitions.XT / totalFromLast;
    if (probFlip > 0.55) return lastTx === 'T' ? 'X' : 'T';
    if (probFlip < 0.45) return lastTx;
    return null;
}

function algoO_RunLengthPredictor(history) {
    if (history.length < 30) return null;
    const features = extractFeatures(history);
    const { runs } = features;
    if (runs.length < 5) return null;
    const recentRuns = runs.slice(-10);
    const runLengths = recentRuns.map(r => r.len);
    const lastRun = recentRuns[recentRuns.length - 1];
    const lengthCounts = {};
    for (const len of runLengths) lengthCounts[len] = (lengthCounts[len] || 0) + 1;
    let mostCommonLen = 1, maxCount = 0;
    for (const len in lengthCounts) {
        if (lengthCounts[len] > maxCount) {
            maxCount = lengthCounts[len];
            mostCommonLen = parseInt(len);
        }
    }
    if (lastRun.len >= mostCommonLen) return lastRun.val === 'T' ? 'X' : 'T';
    if (lastRun.len < mostCommonLen - 1) return lastRun.val;
    return null;
}

function algoP_TimeWeightedMomentum(history) {
    if (history.length < 20) return null;
    const tx = history.map(h => h.tx);
    let momentum = 0, weightSum = 0;
    const decay = 0.9;
    for (let i = tx.length - 1; i >= Math.max(0, tx.length - 20); i--) {
        const weight = Math.pow(decay, tx.length - 1 - i);
        const value = tx[i] === 'T' ? 1 : -1;
        momentum += value * weight;
        weightSum += weight;
    }
    if (weightSum > 0) momentum /= weightSum;
    if (momentum > 0.4) return 'X';
    if (momentum < -0.4) return 'T';
    if (momentum > 0.1) return 'T';
    if (momentum < -0.1) return 'X';
    return null;
}

function algoQ_StreakProbability(history) {
    if (history.length < 15) return null;
    const features = extractFeatures(history);
    const { runs } = features;
    const lastRun = runs[runs.length - 1];
    if (!lastRun) return null;
    const streakLen = lastRun.len;
    const streakVal = lastRun.val;
    const breakProb = STATS.STREAK_BREAK_PROB[Math.min(streakLen, 15)] || 0.999;
    if (breakProb > 0.6) return streakVal === 'T' ? 'X' : 'T';
    if (breakProb < 0.4) return streakVal;
    return null;
}

function algoR_SymmetryDetector(history) {
    if (history.length < 20) return null;
    const features = extractFeatures(history);
    const { runs, tx, isSymmetry, isAlternating, isWave } = features;
    if (runs.length < 4) return null;
    const lastRun = runs[runs.length - 1];

    if (isSymmetry) return lastRun.val === 'T' ? 'X' : 'T';
    if (isAlternating) return tx[tx.length - 1] === 'T' ? 'X' : 'T';
    if (isWave) return tx[tx.length - 1] === 'T' ? 'X' : 'T';

    const runLengths = runs.slice(-7).map(r => r.len);
    if (runLengths.length >= 7) {
        if (checkSymmetry(runLengths)) {
            return lastRun.val === 'T' ? 'X' : 'T';
        }
    }
    return null;
}

function algoT_ZigzagDetector(history) {
    if (history.length < 25) return null;
    const features = extractFeatures(history);
    const { runs, tx, flipStreak } = features;
    if (runs.length < 5) return null;

    const last7Tx = tx.slice(-7);
    if (last7Tx.length === 7) {
        let isZigzag = true;
        for (let i = 1; i < 7; i++) {
            if (last7Tx[i] === last7Tx[i-1]) { isZigzag = false; break; }
        }
        if (isZigzag) return last7Tx[6] === 'T' ? 'X' : 'T';
    }

    if (flipStreak >= 4) return tx[tx.length - 1] === 'T' ? 'X' : 'T';

    const runLengths = runs.slice(-8).map(r => r.len);
    if (runLengths.length >= 6) {
        const is2_1 = runLengths.slice(-6).join('') === '212121';
        const is1_2 = runLengths.slice(-6).join('') === '121212';
        if (is2_1 || is1_2) {
            const lastRun = runs[runs.length - 1];
            return lastRun.val === 'T' ? 'X' : 'T';
        }
    }
    return null;
}

function algoU_WaveDetector(history) {
    if (history.length < 30) return null;
    const features = extractFeatures(history);
    const { runs } = features;
    if (runs.length < 6) return null;

    const runLengths = runs.slice(-8).map(r => r.len);
    if (runLengths.length < 6) return null;

    const pattern = runLengths.join('');
    if (pattern.includes('121212') || pattern.includes('212121')) {
        const lastRun = runs[runs.length - 1];
        return lastRun.len === 1 ? lastRun.val : (lastRun.val === 'T' ? 'X' : 'T');
    }

    const last6 = runLengths.slice(-6);
    let incCount = 0;
    for (let i = 1; i < last6.length; i++) {
        if (last6[i] >= last6[i-1]) incCount++;
    }
    if (incCount >= 4) {
        const lastRun = runs[runs.length - 1];
        return lastRun.val === 'T' ? 'X' : 'T';
    }
    return null;
}

function algoV_LongTermTrend(history) {
    if (history.length < 50) return null;
    const features = extractFeatures(history);
    const { tCount20, tCount30, mean50 } = features;

    const tRatio20 = tCount20 / 20;
    const tRatio30 = tCount30 / 30;

    if (tRatio20 > 0.65 && tRatio30 < 0.5) return 'X';
    if (tRatio20 < 0.35 && tRatio30 > 0.5) return 'T';

    if (mean50 > 12.5) return 'X';
    if (mean50 < 8.5) return 'T';
    return null;
}

function algoW_ConsensusFollow(history) {
    if (history.length < 30) return null;
    const features = extractFeatures(history);
    const { runs, tx } = features;
    if (runs.length < 5) return null;

    const lastRun = runs[runs.length - 1];
    if (lastRun.len >= 3 && lastRun.len <= 5) {
        const last10 = tx.slice(-10);
        const tCount = last10.filter(t => t === 'T').length;
        const xCount = last10.filter(t => t === 'X').length;

        if (lastRun.val === 'T' && tCount >= 6) return 'T';
        if (lastRun.val === 'X' && xCount >= 6) return 'X';
    }
    return null;
}

function algoX_ContrarianExtreme(history) {
    if (history.length < 40) return null;
    const features = extractFeatures(history);
    const { tCount20, tCount30, runs } = features;

    const tRatio20 = tCount20 / 20;
    const tRatio30 = tCount30 / 30;

    if (tRatio20 >= 0.70 && tRatio30 <= 0.55) return 'X';
    if (tRatio20 <= 0.30 && tRatio30 >= 0.45) return 'T';

    const lastRun = runs[runs.length - 1];
    if (lastRun && lastRun.len >= 6) return lastRun.val === 'T' ? 'X' : 'T';
    return null;
}

function algoY_StabilityPredictor(history) {
    if (history.length < 25) return null;
    const features = extractFeatures(history);
    const { runs } = features;

    const runLengths = runs.slice(-8).map(r => r.len);
    if (runLengths.length < 6) return null;

    const meanLen = avg(runLengths);
    const stdLen = stdDev(runLengths);

    if (stdLen < 0.8 && meanLen >= 1 && meanLen <= 3) {
        const lastRun = runs[runs.length - 1];
        const recentRunLengths = runLengths.slice(-3);

        if (recentRunLengths[0] === recentRunLengths[1] &&
            recentRunLengths[1] === recentRunLengths[2]) {
            const targetLen = recentRunLengths[0];
            if (lastRun.len < targetLen) return lastRun.val;
            if (lastRun.len >= targetLen) return lastRun.val === 'T' ? 'X' : 'T';
        }
    }
    return null;
}

// V11.0: Pattern Weighted Predictor
function algoZ_PatternWeighted(history) {
    if (history.length < 25) return null;
    const features = extractFeatures(history);
    const { runs, tx } = features;

    if (runs.length < 5) return null;

    const result = predictWithWeightedPattern(runs, tx, history);

    if (!result.pred) return null;
    if (result.weight < 0.50) return null;
    if (result.originalConfidence < 0.55) return null;

    const last5Runs = runs.slice(-5);
    const recentPatternCheck = detectPatternType(last5Runs, features);
    if (recentPatternCheck === result.pattern) return result.pred;
    return null;
}

const ALL_ALGS = [
    { id: 'algo5_freqrebalance', fn: algo5_freqRebalance },
    { id: 'a_markov', fn: algoA_markov },
    { id: 'b_ngram', fn: algoB_ngram },
    { id: 's_neo_pattern', fn: algoS_NeoPattern },
    { id: 'f_super_deep_analysis', fn: algoF_SuperDeepAnalysis },
    { id: 'e_transformer', fn: algoE_Transformer },
    { id: 'g_super_bridge_predictor', fn: algoG_SuperBridgePredictor },
    { id: 'h_adaptive_markov', fn: algoH_AdaptiveMarkov },
    { id: 'i_pattern_master', fn: algoI_PatternMaster },
    { id: 'j_quantum_entropy', fn: algoJ_QuantumEntropy },
    { id: 'l_momentum_reversal', fn: algoL_MomentumReversal },
    { id: 'm_score_distribution', fn: algoM_ScoreDistribution },
    { id: 'n_transition_matrix', fn: algoN_TransitionMatrix },
    { id: 'o_run_length', fn: algoO_RunLengthPredictor },
    { id: 'p_time_weighted_momentum', fn: algoP_TimeWeightedMomentum },
    { id: 'q_streak_probability', fn: algoQ_StreakProbability },
    { id: 'r_symmetry_detector', fn: algoR_SymmetryDetector },
    { id: 't_zigzag_detector', fn: algoT_ZigzagDetector },
    { id: 'u_wave_detector', fn: algoU_WaveDetector },
    { id: 'v_long_term_trend', fn: algoV_LongTermTrend },
    { id: 'w_consensus_follow', fn: algoW_ConsensusFollow },
    { id: 'x_contrarian_extreme', fn: algoX_ContrarianExtreme },
    { id: 'y_stability_predictor', fn: algoY_StabilityPredictor },
    { id: 'z_pattern_weighted', fn: algoZ_PatternWeighted }
];
// =====================================================================
// PHẦN 6/8: ENSEMBLE V11.0 - WEIGHTED CONSENSUS
// =====================================================================

class AntiBiasDetector {
    constructor(opts = {}) {
        this.recentPredictions = [];
        this.recentActuals = [];
        this.maxWindow = opts.maxWindow ?? 20;
        this.biasThreshold = opts.biasThreshold ?? 0.70;
    }

    record(prediction, actual = null) {
        if (prediction && prediction !== 'chưa có') this.recentPredictions.push(prediction);
        if (actual) this.recentActuals.push(actual);
        if (this.recentPredictions.length > this.maxWindow) {
            this.recentPredictions.shift();
            if (this.recentActuals.length > this.maxWindow) this.recentActuals.shift();
        }
    }

    checkBias() {
        if (this.recentPredictions.length < 10) {
            return { isBiased: false, ratio: 0.5, direction: null, severity: 0 };
        }
        const tCount = this.recentPredictions.filter(p => p === 'T').length;
        const xCount = this.recentPredictions.filter(p => p === 'X').length;
        const total = tCount + xCount;
        if (total === 0) return { isBiased: false, ratio: 0.5, direction: null, severity: 0 };
        const ratio = tCount / total;

        if (ratio > this.biasThreshold) {
            return { isBiased: true, ratio, direction: 'T', severity: (ratio - 0.5) * 2 };
        }
        if (ratio < 1 - this.biasThreshold) {
            return { isBiased: true, ratio, direction: 'X', severity: (0.5 - ratio) * 2 };
        }
        return { isBiased: false, ratio, direction: null, severity: 0 };
    }
}

class SEIUEnsembleV11 {
    constructor(algorithms, opts = {}) {
        this.algs = algorithms;
        this.weights = {};
        this.emaAlpha = opts.emaAlpha ?? 0.10;
        this.minWeight = opts.minWeight ?? 0.01;
        this.performanceHistory = {};
        this.recentPredictions = [];
        this.recentActuals = [];
        this.stuckCounter = 0;
        this.winStreak = 0;
        this.loseStreak = 0;
        this.lastPrediction = null;
        this.totalPredictions = 0;
        this.correctPredictions = 0;

        this.antiBias = new AntiBiasDetector({ maxWindow: 20, biasThreshold: 0.70 });

        this.ALG_ROLES = {
            PRIMARY: ['algo5_freqrebalance', 'a_markov', 's_neo_pattern',
                      'i_pattern_master', 'z_pattern_weighted'],
            SECONDARY: ['b_ngram', 'h_adaptive_markov', 'o_run_length',
                        'r_symmetry_detector', 'w_consensus_follow',
                        'y_stability_predictor'],
            REVERSAL: ['l_momentum_reversal', 'g_super_bridge_predictor',
                       'q_streak_probability', 'x_contrarian_extreme',
                       'v_long_term_trend'],
            CONTEXT: ['f_super_deep_analysis', 'e_transformer',
                      'j_quantum_entropy', 'n_transition_matrix',
                      'p_time_weighted_momentum', 'm_score_distribution',
                      't_zigzag_detector', 'u_wave_detector']
        };

        for (const a of algorithms) {
            this.weights[a.id] = 1.0;
            this.performanceHistory[a.id] = [];
        }
    }

    getAlgRole(algId) {
        for (const [role, list] of Object.entries(this.ALG_ROLES)) {
            if (list.includes(algId)) return role;
        }
        return 'CONTEXT';
    }

    getRecentAccuracy(algId, window = 20) {
        const perf = this.performanceHistory[algId];
        if (!perf || perf.length === 0) return 0.5;
        const recent = perf.slice(-window);
        let weightedSum = 0, weightSum = 0;
        for (let i = 0; i < recent.length; i++) {
            const w = Math.pow(0.92, recent.length - i - 1);
            weightedSum += recent[i] * w;
            weightSum += w;
        }
        return weightSum > 0 ? weightedSum / weightSum : 0.5;
    }

    fitInitial(history) {
        const window = lastN(history, Math.min(700, history.length));
        if (window.length < 30) return;
        const evalSamples = Math.min(80, window.length - 20);
        const startIdx = window.length - evalSamples;

        for (const a of this.algs) {
            let correct = 0, total = 0;
            for (let i = Math.max(20, startIdx); i < window.length; i++) {
                const prefix = window.slice(0, i);
                try {
                    const pred = a.fn(prefix);
                    if (pred) {
                        total++;
                        if (pred === window[i].tx) correct++;
                    }
                } catch (e) {}
            }
            const accuracy = total > 0 ? correct / total : 0.5;
            this.weights[a.id] = Math.max(this.minWeight, Math.pow(accuracy, 2) * 3);
            for (let j = 0; j < 10; j++) {
                this.performanceHistory[a.id].push(accuracy > 0.5 ? 1 : 0);
            }
        }
        this.normalizeWeights();
        console.log(`⚖️ V11.0: Init ${this.algs.length} thuật toán xong.`);
    }

    normalizeWeights() {
        const total = Object.values(this.weights).reduce((s, w) => s + w, 0);
        if (total > 0) for (const id in this.weights) this.weights[id] /= total;
    }

    updateWithOutcome(historyPrefix, actualTx) {
        if (historyPrefix.length < 10) return;
        this.recentActuals.push(actualTx);
        if (this.recentActuals.length > 20) this.recentActuals.shift();

        if (this.lastPrediction && this.lastPrediction !== 'chưa có') {
            if (this.lastPrediction === actualTx) {
                this.winStreak++;
                this.loseStreak = 0;
                this.correctPredictions++;
            } else {
                this.loseStreak++;
                this.winStreak = 0;
            }
            this.totalPredictions++;
        }

        for (const a of this.algs) {
            try {
                const pred = a.fn(historyPrefix);
                if (!pred) continue;

                const correct = pred === actualTx ? 1 : 0;
                this.performanceHistory[a.id].push(correct);
                if (this.performanceHistory[a.id].length > 100) {
                    this.performanceHistory[a.id].shift();
                }

                const accuracy = this.getRecentAccuracy(a.id, 20);
                const acc5 = this.getRecentAccuracy(a.id, 5);

                let targetWeight = Math.pow(accuracy, 2);
                if (acc5 > 0.7) targetWeight *= 1.5;
                if (acc5 < 0.3) targetWeight *= 0.5;

                const currentW = this.weights[a.id];
                this.weights[a.id] = this.emaAlpha * targetWeight + (1 - this.emaAlpha) * currentW;
                this.weights[a.id] = Math.max(this.minWeight, Math.min(0.5, this.weights[a.id]));
            } catch (e) {
                this.weights[a.id] = Math.max(this.minWeight, this.weights[a.id] * 0.95);
            }
        }
        this.normalizeWeights();
    }

    predict(history) {
        if (history.length < 12) {
            const recentTx = history.map(h => h.tx);
            const tCount = recentTx.filter(t => t === 'T').length;
            const xCount = recentTx.filter(t => t === 'X').length;
            const fallback = tCount > xCount ? 'X' : 'T';
            this.lastPrediction = fallback;
            return { prediction: fallback === 'T' ? 'tài' : 'xỉu',
                     confidence: 0.5, rawPrediction: fallback };
        }

        const votes = { T: 0, X: 0 };
        const roleVotes = {
            PRIMARY: {T:0,X:0},
            SECONDARY: {T:0,X:0},
            REVERSAL: {T:0,X:0},
            CONTEXT: {T:0,X:0}
        };
        const details = [];

        for (const a of this.algs) {
            try {
                const pred = a.fn(history);
                if (!pred) continue;

                const role = this.getAlgRole(a.id);
                const accuracy = this.getRecentAccuracy(a.id, 20);

                if (accuracy < 0.35 && this.performanceHistory[a.id].length >= 10) {
                    continue;
                }

                let weight = this.weights[a.id] * Math.pow(accuracy, 1.5);

                if (role === 'PRIMARY') weight *= 1.5;
                if (role === 'REVERSAL') weight *= 0.9;

                votes[pred] += weight;
                roleVotes[role][pred] += weight;

                details.push({
                    alg: a.id, pred, weight: weight.toFixed(4),
                    role, accuracy: accuracy.toFixed(3)
                });
            } catch (e) {}
        }

        const totalVotes = votes.T + votes.X;
        if (totalVotes < 0.01) {
            return { prediction: 'chưa có', confidence: 0, rawPrediction: null };
        }

        const tRatio = votes.T / totalVotes;
        const xRatio = votes.X / totalVotes;

        let best = tRatio > xRatio ? 'T' : 'X';
        let confidence = Math.max(tRatio, xRatio);

        const roleWinners = {};
        for (const [role, rv] of Object.entries(roleVotes)) {
            if (rv.T + rv.X > 0) {
                roleWinners[role] = rv.T > rv.X ? 'T' : 'X';
            }
        }
        const roleValues = Object.values(roleWinners);
        const consensusCount = roleValues.filter(v => v === best).length;
        const consensusRatio = roleValues.length > 0 ? consensusCount / roleValues.length : 0.5;

        if (consensusRatio >= 0.75) confidence = Math.min(0.95, confidence * 1.15);
        else if (consensusRatio <= 0.5) confidence *= 0.85;

        const MIN_CONF = 0.62;
        if (confidence < MIN_CONF) {
            return {
                prediction: 'chưa có',
                confidence,
                rawPrediction: null,
                reason: `Confidence ${(confidence*100).toFixed(0)}% < ${(MIN_CONF*100)}%`
            };
        }

        if (this.loseStreak >= 4) {
            const flipped = best === 'T' ? 'X' : 'T';
            console.log(`🚨 V11.0 ANTI-STUCK: loseStreak=${this.loseStreak} → flip ${best}→${flipped}`);
            best = flipped;
            confidence = Math.min(confidence * 1.05, 0.90);
            this.loseStreak = 0;
        }

        this.lastPrediction = best;
        this.recentPredictions.push(best);
        if (this.recentPredictions.length > 20) this.recentPredictions.shift();

        this.antiBias.record(best);

        return {
            prediction: best === 'T' ? 'tài' : 'xỉu',
            confidence,
            rawPrediction: best,
            consensusRatio,
            details
        };
    }
}
// =====================================================================
// PHẦN 7/8: SEIU MANAGER + FETCH LOGIC
// =====================================================================

class SEIUManager {
    constructor(opts = {}) {
        this.history = [];
        this.ensemble = new SEIUEnsembleV11(ALL_ALGS, {
            emaAlpha: opts.emaAlpha ?? 0.10,
            historyWindow: opts.historyWindow ?? 700
        });
        this.currentPrediction = null;
        this.lastPrediction = null;
        this.lastPredictionForSession = null;
        this.patternHistory = [];
    }

    calculateInitialStats() {
        const minStart = 20;
        if (this.history.length < minStart) return;
        const trainSamples = Math.min(80, this.history.length - minStart);
        const startIdx = this.history.length - trainSamples;
        for (let i = Math.max(minStart, startIdx); i < this.history.length; i++) {
            const prefix = this.history.slice(0, i);
            this.ensemble.updateWithOutcome(prefix, this.history[i].tx);
        }
        console.log(`📊 AI huấn luyện ${trainSamples} mẫu.`);
    }

    loadInitial(lines) {
        this.history = lines;
        this.ensemble.fitInitial(this.history);
        this.calculateInitialStats();
        this.currentPrediction = this.getPrediction();
        this.lastPrediction = this.currentPrediction;
        this.lastPredictionForSession = this.history.at(-1)?.session + 1 || null;
        console.log("📦 Đã tải lịch sử. AI sẵn sàng.");
        const nextSession = this.history.at(-1) ? this.history.at(-1).session + 1 : 'N/A';
        console.log(`🔮 Dự đoán phiên ${nextSession}: ${this.currentPrediction.prediction} (${(this.currentPrediction.confidence * 100).toFixed(0)}%)`);
    }

    pushRecord(record) {
        if (this.lastPrediction && this.lastPredictionForSession === record.session &&
            this.lastPrediction.rawPrediction) {
            record.prediction = this.lastPrediction.prediction;
            record.prediction_confidence = Math.round(this.lastPrediction.confidence * 100);
            record.correct = this.lastPrediction.rawPrediction === record.tx;
        } else {
            record.prediction = null;
            record.prediction_confidence = null;
            record.correct = null;
        }

        this.history.push(record);
        if (this.history.length > MAX_HISTORY) this.history = this.history.slice(-MAX_HISTORY + 50);

        const prefix = this.history.slice(0, -1);
        if (prefix.length >= 10) this.ensemble.updateWithOutcome(prefix, record.tx);

        this.lastPrediction = this.getPrediction();
        this.currentPrediction = this.lastPrediction;
        this.lastPredictionForSession = record.session + 1;

        const features = extractFeatures(this.history);
        const patternType = detectPatternType(features.runs, features);
        if (patternType) {
            this.patternHistory.push(patternType);
            if (this.patternHistory.length > 20) this.patternHistory.shift();
        }
        console.log(`📥 ${record.session} → ${record.result}. Dự đoán ${record.session + 1}: ${this.currentPrediction.prediction} (${(this.currentPrediction.confidence * 100).toFixed(0)}%)`);
    }

    getPrediction() {
        return this.ensemble.predict(this.history);
    }
}

async function fetchAndProcessTable(tableKey) {
    const table = TABLES[tableKey];
    try {
        const response = await fetch(table.apiUrl);
        const data = await response.json();

        let newHistory;
        if (tableKey === 'md5') newHistory = parseMd5Data(data);
        else newHistory = parseHuData(data);

        if (newHistory.length === 0) {
            console.log(`⚠️ ${table.name}: Không có dữ liệu từ API.`);
            return;
        }

        const lastSessionInHistory = newHistory.at(-1);

        if (!table.currentSessionId) {
            table.manager = new SEIUManager();
            table.manager.loadInitial(newHistory);
            table.history = newHistory;
            table.currentSessionId = lastSessionInHistory.session;
            console.log(`✅ ${table.name}: Đã tải ${newHistory.length} phiên lịch sử.`);
        } else if (lastSessionInHistory.session > table.currentSessionId) {
            const newRecords = newHistory.filter(r => r.session > table.currentSessionId);
            for (const record of newRecords) {
                table.manager.pushRecord(record);
                table.history.push(record);
            }
            if (table.history.length > MAX_HISTORY) table.history = table.history.slice(-MAX_HISTORY);
            table.currentSessionId = lastSessionInHistory.session;
            if (newRecords.length > 0) {
                console.log(`🆕 ${table.name}: Cập nhật ${newRecords.length} phiên. Phiên cuối: ${table.currentSessionId}`);
            }
        }
    } catch (e) {
        console.error(`❌ Lỗi fetch ${table.name}:`, e.message);
    }
}

async function fetchAllTables() {
    await Promise.all([fetchAndProcessTable('md5'), fetchAndProcessTable('hu')]);
}
// =====================================================================
// PHẦN 8/8: API SERVER + ENDPOINTS + START
// =====================================================================

const app = fastify({ logger: false });
await app.register(cors, { origin: "*" });

function buildPredictionResponse(tableKey) {
    const table = TABLES[tableKey];
    const lastResult = table.history.at(-1) || null;
    const currentPrediction = table.manager?.currentPrediction;

    if (!lastResult || !currentPrediction) {
        return {
            id: "@cskhgiabao",
            phien_truoc: null,
            xuc_xac: null,
            ket_qua: "đang chờ...",
            phien_nay: null,
            du_doan: "chưa có",
            do_tin_cay: "0%"
        };
    }

    return {
        id: "@cskhgiabao",
        phien_truoc: lastResult.session,
        xuc_xac: lastResult.dice,
        ket_qua: lastResult.result.toLowerCase(),
        phien_nay: lastResult.session + 1,
        du_doan: currentPrediction.prediction,
        do_tin_cay: `${Math.round(currentPrediction.confidence * 100)}%`
    };
}

function buildHistoryResponse(tableKey) {
    const table = TABLES[tableKey];
    if (!table.history.length) return [];

    const reversedHistory = [...table.history].sort((a, b) => b.session - a.session);

    return reversedHistory.map((i) => {
        let note = "";
        let correct = null;
        let prediction = i.prediction || null;
        let predictionConfidence = i.prediction_confidence || null;

        if (prediction !== null && i.correct !== null && i.correct !== undefined) {
            correct = i.correct;
            note = i.correct ? "đúng ✅" : "sai ❌";
        } else {
            note = "không có dự đoán";
        }

        return {
            session: i.session,
            dice: i.dice,
            total: i.total,
            result: i.result.toLowerCase(),
            tx_label: i.tx.toLowerCase(),
            prediction: prediction,
            prediction_confidence: predictionConfidence,
            correct: correct,
            note: note
        };
    });
}

app.get("/api/lc79/txmd5", async () => buildPredictionResponse('md5'));
app.get("/api/lc79/tx", async () => buildPredictionResponse('hu'));

app.get("/api/lc79/txmd5/history", async () => {
    const history = buildHistoryResponse('md5');
    if (!history.length) return { message: "không có dữ liệu lịch sử." };
    return history;
});

app.get("/api/lc79/tx/history", async () => {
    const history = buildHistoryResponse('hu');
    if (!history.length) return { message: "không có dữ liệu lịch sử." };
    return history;
});

app.get("/api/taixiumd5/lc79", async () => buildPredictionResponse('md5'));
app.get("/api/taixiumd5/history", async () => buildHistoryResponse('md5'));

app.get("/api/balance/stats", async () => {
    const result = {};
    for (const key of ['md5', 'hu']) {
        const table = TABLES[key];
        if (!table.manager) {
            result[key] = { error: "chưa load" };
            continue;
        }
        const preds = table.manager.ensemble.recentPredictions;
        const acts = table.manager.ensemble.recentActuals;

        const predT = preds.filter(p => p === 'T').length;
        const predX = preds.filter(p => p === 'X').length;
        const actT = acts.filter(a => a === 'T').length;
        const actX = acts.filter(a => a === 'X').length;
        const bias = table.manager.ensemble.antiBias.checkBias();

        const total = table.manager.ensemble.totalPredictions;
        const correct = table.manager.ensemble.correctPredictions;

        result[key] = {
            predictions: {
                total: preds.length,
                T: predT,
                X: predX,
                ratio_T: preds.length > 0 ? (predT / preds.length * 100).toFixed(1) + '%' : '0%'
            },
            actuals: {
                total: acts.length,
                T: actT,
                X: actX,
                ratio_T: acts.length > 0 ? (actT / acts.length * 100).toFixed(1) + '%' : '0%'
            },
            accuracy: {
                total: total,
                correct: correct,
                rate: total > 0 ? (correct / total * 100).toFixed(1) + '%' : '0%'
            },
            bias: {
                isBiased: bias.isBiased,
                direction: bias.direction,
                ratio: (bias.ratio * 100).toFixed(1) + '%',
                severity: bias.severity ? (bias.severity * 100).toFixed(1) + '%' : '0%'
            }
        };
    }
    return result;
});

app.get("/", async () => {
    return {
        status: "ok",
        msg: "AI Tài Xỉu V11.0 - Pattern Frequency Weighting Edition",
        version: "11.0",
        algorithms: ALL_ALGS.length,
        patterns: Object.keys(PATTERN_WEIGHTS).length + " mẫu cầu có trọng số",
        tables: ["md5", "hu"],
        endpoints: [
            "GET /api/lc79/txmd5           → Dự đoán MD5",
            "GET /api/lc79/tx              → Dự đoán Hũ",
            "GET /api/lc79/txmd5/history   → Lịch sử MD5 (✅/❌)",
            "GET /api/lc79/tx/history      → Lịch sử Hũ (✅/❌)",
            "GET /api/balance/stats        → Thống kê"
        ]
    };
});

const start = async () => {
    try {
        await app.listen({ port: PORT, host: "0.0.0.0" });
    } catch (err) {
        console.error("❌ Lỗi khởi động:", err.message);
        process.exit(1);
    }

    let publicIP = "0.0.0.0";
    try {
        const res = await fetch("https://ifconfig.me/ip");
        publicIP = (await res.text()).trim();
    } catch (e) {}

    console.log("\n🚀 AI Tài Xỉu V11.0 - Pattern Frequency Weighting!");
    console.log(`   ➜ Local:   http://localhost:${PORT}/`);
    console.log(`   ➜ Network: http://${publicIP}:${PORT}/\n`);
    console.log("📌 API endpoints:");
    console.log(`   ➜ GET /api/lc79/txmd5         → Dự đoán MD5`);
    console.log(`   ➜ GET /api/lc79/tx            → Dự đoán Hũ`);
    console.log(`   ➜ GET /api/lc79/txmd5/history → Lịch sử MD5`);
    console.log(`   ➜ GET /api/lc79/tx/history    → Lịch sử Hũ`);
    console.log(`   ➜ GET /api/balance/stats      → Thống kê`);

    console.log(`\n⚖️ 5 LỚP CÂN BẰNG V11.0:`);
    console.log("   1. Pattern Frequency Weight (mẫu phổ biến vote mạnh)");
    console.log("   2. Weighted Voting (thuật toán chính xác vote mạnh)");
    console.log("   3. Confidence Gate (chỉ đoán khi >= 62%)");
    console.log("   4. Role-based Consensus (đồng thuận 3/4 roles)");
    console.log("   5. Anti-Stuck (chỉ flip khi loseStreak >= 4)");

    console.log(`\n🔧 ${ALL_ALGS.length} thuật toán:`);
    ALL_ALGS.forEach((alg, i) => console.log(`   ${i+1}. ${alg.id}`));

    console.log(`\n📊 ${Object.keys(PATTERN_WEIGHTS).length} mẫu cầu có trọng số theo tần suất thực:`);
    console.log("   • Trọng số 1.00: 1_1, 2_2, bệt 3-4");
    console.log("   • Trọng số 0.60-0.85: 3_3, 1_2_1, 3_2_3, bệt 5-8");
    console.log("   • Trọng số 0.20-0.50: 4_4, loop, broken, mirror");
    console.log("   • Trọng số 0.05-0.15: Fibonacci, perfect alternate, spike hiếm");

    await fetchAllTables();
    setInterval(fetchAllTables, FETCH_INTERVAL);
    console.log(`\n🔄 Chu kỳ fetch ${FETCH_INTERVAL/1000}s cho cả 2 bàn.`);
};

start();