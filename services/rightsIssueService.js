// Rights Issue (HMETD) Analytics & Calculation Engine for IDX Stocks
const { sanitizeTicker } = require('./utils');

// Known / Benchmark / Active Rights Issue registry in IDX
const RIGHTS_ISSUE_REGISTRY = {
    'BBRI': {
        ticker: 'BBRI',
        name: 'PT Bank Rakyat Indonesia (Persero) Tbk',
        ratioOld: 100000000,
        ratioNew: 28213191,
        ratioDisplay: '100 : 28',
        exercisePrice: 3400,
        cumDatePrice: 3950,
        standbyBuyer: 'Pemerintah Republik Indonesia (Inbreng Pegadaian & PNM)',
        standbyBuyerCommitment: true,
        targetProceeds: 'Rp 96,00 Triliun',
        cumDate: '2021-09-09',
        exDate: '2021-09-10',
        tradingStart: '2021-09-13',
        tradingEnd: '2021-09-22',
        useOfFunds: 'Pembentukan Holding Ultra Mikro (Inbreng Pegadaian & PNM) dan ekspansi kredit UMKM.',
        status: 'SELESAI / HISTORIS BENCHMARK'
    },
    'BBTN': {
        ticker: 'BBTN',
        name: 'PT Bank Tabungan Negara (Persero) Tbk',
        ratioOld: 10000,
        ratioNew: 4600,
        ratioDisplay: '100 : 46',
        exercisePrice: 1200,
        cumDatePrice: 1350,
        standbyBuyer: 'Pemerintah RI (PMN) & Konsorsium Underwriter',
        standbyBuyerCommitment: true,
        targetProceeds: 'Rp 4,13 Triliun',
        cumDate: '2022-12-22',
        exDate: '2022-12-23',
        tradingStart: '2022-12-28',
        tradingEnd: '2023-01-05',
        useOfFunds: 'Penguatan struktur permodalan (Tier 1 Capital) dan penyaluran KPR Subsidi.',
        status: 'SELESAI / HISTORIS'
    },
    'BBYB': {
        ticker: 'BBYB',
        name: 'PT Bank Neo Commerce Tbk',
        ratioOld: 100,
        ratioNew: 35,
        ratioDisplay: '100 : 35',
        exercisePrice: 300,
        cumDatePrice: 280,
        standbyBuyer: 'PT Akulaku Silvrr Indonesia',
        standbyBuyerCommitment: true,
        targetProceeds: 'Rp 1,01 Triliun',
        cumDate: '2024-06-25',
        exDate: '2024-06-26',
        tradingStart: '2024-07-01',
        tradingEnd: '2024-07-08',
        useOfFunds: 'Pemenuhan modal inti minimum OJK dan ekspansi kredit digital.',
        status: 'SELESAI / HISTORIS'
    },
    'BANK': {
        ticker: 'BANK',
        name: 'PT Bank Aladin Syariah Tbk',
        ratioOld: 100,
        ratioNew: 15,
        ratioDisplay: '100 : 15',
        exercisePrice: 2000,
        cumDatePrice: 1400,
        standbyBuyer: 'Tidak Ada (Best Effort)',
        standbyBuyerCommitment: false,
        targetProceeds: 'Rp 2,10 Triliun',
        cumDate: '2022-11-15',
        exDate: '2022-11-16',
        tradingStart: '2022-11-21',
        tradingEnd: '2022-11-28',
        useOfFunds: 'Penguatan infrastruktur teknologi dan modal kerja syariah.',
        status: 'SELESAI / HISTORIS'
    },
    'AGRO': {
        ticker: 'AGRO',
        name: 'PT Bank Raya Indonesia Tbk',
        ratioOld: 100,
        ratioNew: 18,
        ratioDisplay: '100 : 18',
        exercisePrice: 500,
        cumDatePrice: 420,
        standbyBuyer: 'PT Bank Rakyat Indonesia (Persero) Tbk',
        standbyBuyerCommitment: true,
        targetProceeds: 'Rp 1,16 Triliun',
        cumDate: '2022-12-08',
        exDate: '2022-12-09',
        tradingStart: '2022-12-14',
        tradingEnd: '2022-12-21',
        useOfFunds: 'Penguatan modal kerja dan penetrasi produk digital gig economy.',
        status: 'SELESAI / HISTORIS'
    },
    'FREN': {
        ticker: 'FREN',
        name: 'PT Smartfren Telecom Tbk',
        ratioOld: 100,
        ratioNew: 78,
        ratioDisplay: '100 : 78',
        exercisePrice: 50,
        cumDatePrice: 52,
        standbyBuyer: 'Sinarmas Group & Konsorsium',
        standbyBuyerCommitment: true,
        targetProceeds: 'Rp 8,57 Triliun',
        cumDate: '2024-03-18',
        exDate: '2024-03-19',
        tradingStart: '2024-03-22',
        tradingEnd: '2024-04-03',
        useOfFunds: 'Pelunasan pinjaman dan belanja modal infrastruktur jaringan.',
        status: 'SELESAI / HISTORIS'
    },
    'NOBU': {
        ticker: 'NOBU',
        name: 'PT Bank Nationalnobu Tbk',
        ratioOld: 100,
        ratioNew: 41,
        ratioDisplay: '100 : 41',
        exercisePrice: 590,
        cumDatePrice: 650,
        standbyBuyer: 'PT Kharisma Sukses Persada (Lippo Group)',
        standbyBuyerCommitment: true,
        targetProceeds: 'Rp 700 Miliar',
        cumDate: '2023-11-20',
        exDate: '2023-11-21',
        tradingStart: '2023-11-27',
        tradingEnd: '2023-12-04',
        useOfFunds: 'Penguatan modal inti bank umum kelompok usaha.',
        status: 'SELESAI / HISTORIS'
    }
};

/**
 * Calculate Theoretical Price for Rights Issue (HMETD)
 * Formula: Theoretical Price = ((N * P0) + (R * Pe)) / (N + R)
 */
function calculateTheoreticalPrice(cumPrice, ratioOld, ratioNew, exercisePrice) {
    const N = Number(ratioOld) || 1;
    const R = Number(ratioNew) || 0;
    const P0 = Number(cumPrice) || 0;
    const Pe = Number(exercisePrice) || 0;

    if (N + R === 0) return P0;
    const theoretical = ((N * P0) + (R * Pe)) / (N + R);
    return Math.round(theoretical);
}

/**
 * Calculate Dilution Percentage
 * Formula: Dilution % = (R / (N + R)) * 100%
 */
function calculateDilution(ratioOld, ratioNew) {
    const N = Number(ratioOld) || 1;
    const R = Number(ratioNew) || 0;
    if (N + R === 0) return 0;
    const dilution = (R / (N + R)) * 100;
    return Number(dilution.toFixed(2));
}

/**
 * Calculate Discount / Premium Percentage
 * Formula: Discount % = ((P0 - Pe) / P0) * 100%
 */
function calculateDiscount(cumPrice, exercisePrice) {
    const P0 = Number(cumPrice) || 0;
    const Pe = Number(exercisePrice) || 0;
    if (P0 <= 0) return 0;
    const discount = ((P0 - Pe) / P0) * 100;
    return Number(discount.toFixed(2));
}

/**
 * Generate Auto Rights Issue AI Strategic Conclusion
 */
function generateRightsIssueSummary({ discountPct, dilutionPct, standbyBuyer, standbyBuyerCommitment, exercisePrice, cumPrice }) {
    const isDiscount = discountPct > 0;
    const isPremium = exercisePrice > cumPrice;
    const hasStandby = standbyBuyerCommitment && standbyBuyer && !standbyBuyer.toLowerCase().includes('tidak ada');

    if (isPremium) {
        return `WASPADA: Harga tebus lebih mahal dari harga pasar (Premium ${Math.abs(discountPct)}%). HMETD berpotensi kurang menarik bagi publik dan berisiko tidak ditebus seluruhnya jika harga pasar di bawah harga pelaksanaan.`;
    }

    if (dilutionPct > 30 && !hasStandby) {
        return `RISIKAN: Efek dilusi sangat tinggi (${dilutionPct}%) tanpa Pembeli Siaga terkonfirmasi. Berpotensi menekan harga saham pasca Cum-Date karena risiko aksi jual hak HMETD di pasar tunai.`;
    }

    if (isDiscount && hasStandby) {
        return `POSITIF: Harga tebus diskon (${discountPct}%) dibanding pasar dengan Pembeli Siaga Komit (${standbyBuyer}). Risiko dilusi ${dilutionPct}%, disarankan tebus HMETD untuk menjaga porsi saham dan mengoptimalkan harga rata-rata modal.`;
    }

    if (isDiscount) {
        return `MODERAT: Harga tebus menawarkan diskon (${discountPct}%) dengan estimasi efek dilusi ${dilutionPct}%. Investor disarankan mencermati likuiditas pasar dan kepastian serapan HMETD sebelum memutuskan mengeksekusi hak.`;
    }

    return `NETRAL: Harga tebus mendekati harga pasar saat ini (Diskon/Premium: ${discountPct}%). Efek dilusi tercatat sebesar ${dilutionPct}%.`;
}

/**
 * Calculate Tebus Simulation (User lot holdings)
 */
function calculateTebus({ ownedLots = 100, ratioOld = 100, ratioNew = 35, exercisePrice = 1000, cumPrice = 1200 }) {
    const N = Number(ratioOld) || 1;
    const R = Number(ratioNew) || 0;
    const Pe = Number(exercisePrice) || 0;
    const P0 = Number(cumPrice) || 0;
    const L = Math.max(0, Math.floor(Number(ownedLots) || 0));

    // Rights obtained in lots: floor(L * (R / N))
    const rightsLots = Math.floor(L * (R / N));
    const rightsShares = rightsLots * 100;
    const totalCostRp = rightsShares * Pe;

    const initialCostRp = L * 100 * P0;
    const totalSharesPost = (L + rightsLots) * 100;
    const avgPricePost = totalSharesPost > 0 ? Math.round((initialCostRp + totalCostRp) / totalSharesPost) : 0;

    const theoreticalPrice = calculateTheoreticalPrice(P0, N, R, Pe);
    const dilutionPct = calculateDilution(N, R);
    const discountPct = calculateDiscount(P0, Pe);

    return {
        ownedLots: L,
        rightsLots,
        rightsShares,
        totalCostRp,
        initialCostRp,
        totalSharesPost,
        avgPricePost,
        theoreticalPrice,
        dilutionPct,
        discountPct
    };
}

/**
 * Get Rights Issue Data for a Ticker
 */
function getRightsIssueData(ticker, currentPrice = null) {
    const clean = sanitizeTicker(ticker);
    const known = RIGHTS_ISSUE_REGISTRY[clean];

    if (known) {
        const cumPrice = currentPrice || known.cumDatePrice;
        const theoreticalPrice = calculateTheoreticalPrice(cumPrice, known.ratioOld, known.ratioNew, known.exercisePrice);
        const dilutionPct = calculateDilution(known.ratioOld, known.ratioNew);
        const discountPct = calculateDiscount(cumPrice, known.exercisePrice);
        const aiSummary = generateRightsIssueSummary({
            discountPct,
            dilutionPct,
            standbyBuyer: known.standbyBuyer,
            standbyBuyerCommitment: known.standbyBuyerCommitment,
            exercisePrice: known.exercisePrice,
            cumPrice
        });

        const defaultSimulation = calculateTebus({
            ownedLots: 100,
            ratioOld: known.ratioOld,
            ratioNew: known.ratioNew,
            exercisePrice: known.exercisePrice,
            cumPrice
        });

        return {
            hasRightsIssue: true,
            isCorporateActionActive: known.status.includes('AKTIF'),
            status: known.status,
            ticker: clean,
            name: known.name,
            ratioOld: known.ratioOld,
            ratioNew: known.ratioNew,
            ratioDisplay: known.ratioDisplay,
            exercisePrice: known.exercisePrice,
            cumPrice,
            theoreticalPrice,
            dilutionPct,
            discountPct,
            standbyBuyer: known.standbyBuyer,
            standbyBuyerCommitment: known.standbyBuyerCommitment,
            targetProceeds: known.targetProceeds,
            useOfFunds: known.useOfFunds,
            dates: {
                cumDate: known.cumDate,
                exDate: known.exDate,
                tradingStart: known.tradingStart,
                tradingEnd: known.tradingEnd
            },
            aiSummary,
            defaultSimulation
        };
    }

    // Default Simulation Template for tickers without registered active rights issue
    const p0 = currentPrice || 1000;
    const simOld = 100;
    const simNew = 25;
    const simPe = Math.round(p0 * 0.85); // 15% discount default simulation
    const simTheo = calculateTheoreticalPrice(p0, simOld, simNew, simPe);
    const simDilution = calculateDilution(simOld, simNew);
    const simDiscount = calculateDiscount(p0, simPe);

    return {
        hasRightsIssue: false,
        isCorporateActionActive: false,
        status: 'SIMULASI KALKULATOR TERSEDIA',
        ticker: clean,
        name: `PT ${clean} Tbk`,
        ratioOld: simOld,
        ratioNew: simNew,
        ratioDisplay: '100 : 25 (Simulasi)',
        exercisePrice: simPe,
        cumPrice: p0,
        theoreticalPrice: simTheo,
        dilutionPct: simDilution,
        discountPct: simDiscount,
        standbyBuyer: 'Pemegang Saham Pengendali (PSP)',
        standbyBuyerCommitment: true,
        targetProceeds: 'Estimasi Berdasarkan Target Ekspansi',
        useOfFunds: 'Modal Kerja & Belanja Modal Ekspansi Usaha',
        dates: {
            cumDate: '-',
            exDate: '-',
            tradingStart: '-',
            tradingEnd: '-'
        },
        aiSummary: `Emiten ${clean} saat ini tidak memiliki aksi korporasi HMETD aktif yang terdaftar. Fitur kalkulator HMETD interaktif siap digunakan untuk simulasi skenario right issue dan perhitungan harga teoretis.`,
        defaultSimulation: calculateTebus({
            ownedLots: 100,
            ratioOld: simOld,
            ratioNew: simNew,
            exercisePrice: simPe,
            cumPrice: p0
        })
    };
}

module.exports = {
    getRightsIssueData,
    calculateTheoreticalPrice,
    calculateDilution,
    calculateDiscount,
    calculateTebus,
    generateRightsIssueSummary,
    RIGHTS_ISSUE_REGISTRY
};
