// Test Sort Valid Cards logic
function testSort(editorCards, checkerInput) {
    const raw = checkerInput;
    const cardStatus = new Map();
    const last4Status = new Map();

    const isBreakdownFormat = raw.includes('\u2503') && /\d{4,6}[\u2022\u2022]{2,}\d{3,4}/.test(raw);

    if (isBreakdownFormat) {
        const lines = raw.split('\n');
        for (const line of lines) {
            let status = null;
            if (line.includes('\u{1F7E2}')) status = 'valid';
            else if (line.includes('\u{1F534}')) status = 'dead';
            else if (line.includes('\u{1F7E1}')) status = 'unknown';
            if (!status) continue;
            const maskedMatch = line.match(/(\d{4,6})[\u2022]{2,}(\d{3,4})/);
            if (maskedMatch) {
                last4Status.set(maskedMatch[2].slice(-4), status);
            }
        }
        const approvedMatch = raw.match(/APPROVED CARDS[^\n]*\n([\s\S]*?)(\u2523|$)/i);
        if (approvedMatch) {
            const section = approvedMatch[1];
            if (!section.toLowerCase().includes('none')) {
                const approvedNums = section.match(/\d{13,19}/g);
                if (approvedNums) {
                    approvedNums.forEach(n => {
                        cardStatus.set(n, 'valid');
                        last4Status.set(n.slice(-4), 'valid');
                    });
                }
            }
        }
    } else {
        raw.split('\n').forEach(line => {
            const nums = line.match(/\d{13,19}/g);
            if (!nums) return;
            const lower = line.toLowerCase();
            const isValid = lower.includes('approved') || lower.includes('alive') ||
                lower.includes('live') || lower.includes('charged') ||
                lower.includes('valid') || lower.includes('success') ||
                lower.includes('active') || lower.includes('cvv match') ||
                lower.includes('ccn live') || line.includes('\u2705') ||
                line.includes('\u{2705}');
            cardStatus.set(nums[0], isValid ? 'valid' : 'dead');
        });
    }

    const results = [];
    editorCards.forEach(cardLine => {
        const nums = cardLine.match(/\d{13,19}/g);
        if (!nums) { results.push({ card: cardLine, status: 'no-card' }); return; }
        let status = null;
        if (cardStatus.has(nums[0])) status = cardStatus.get(nums[0]);
        if (!status && last4Status.size > 0) {
            const last4 = nums[0].slice(-4);
            if (last4Status.has(last4)) status = last4Status.get(last4);
        }
        results.push({ card: cardLine, status: status || 'unchecked', num: nums[0] });
    });
    return { results, format: isBreakdownFormat ? 'BREAKDOWN' : 'ORIGINAL', cardStatusSize: cardStatus.size, last4StatusSize: last4Status.size };
}

const editorCards = [
    '4017954158670993 05 27 321',
    '5217295402122760 10 26 819',
    '5217291934622369 01 27 185',
    '5217291957981791 10 28 297',
    '5523502400886386 01 28 342',
    '5217293039207294 01 29 439',
    '5217293027071454 08 28 095',
    '4622391122136206 09 28 677'
];

// TEST 1
console.log('=== TEST 1: Original Format ===');
const checker1 = '4017954158670993 |   \u26D4\uFE0F\n5217295402122760 |  DO NOT TRY AGAIN \u26D4\uFE0F\n5217291934622369 |  Approved \u2705\n5217291957981791 |   \u26D4\uFE0F';
const t1 = testSort(editorCards, checker1);
console.log('Format:', t1.format, '| cardStatus:', t1.cardStatusSize, '| last4Status:', t1.last4StatusSize);
t1.results.forEach(r => console.log(`  ${r.card} => ${r.status}`));
const t1v = t1.results.filter(r => r.status === 'valid').length;
const t1d = t1.results.filter(r => r.status === 'dead').length;
const t1u = t1.results.filter(r => r.status === 'unchecked').length;
console.log(`Counts: ${t1v} valid, ${t1d} dead, ${t1u} unchecked`);
console.log(t1v===1 && t1d===3 && t1u===4 ? 'PASS' : 'FAIL');

// TEST 2
console.log('\n=== TEST 2: Breakdown Format ===');
const checker2 = 'RESULTS BREAKDOWN:\n\u2503\n\u2503 9. \u{1F534} 521729\u2022\u2022\u2022\u2022\u2022\u20227294 | 01/29\n\u2503    \u2514 3-D Secure Check Failed\n\u2503 10. \u{1F534} 552350\u2022\u2022\u2022\u2022\u2022\u20226386 | 01/28\n\u2503    \u2514 Card declined\n\u2503 11. \u{1F7E2} 521729\u2022\u2022\u2022\u2022\u2022\u20222369 | 08/28\n\u2503    \u2514 MasterCard \u2022\u2022\u2022\u2022 2369\n\u2503 12. \u{1F534} 521729\u2022\u2022\u2022\u2022\u2022\u20223435 | 05/28\n\u2503    \u2514 3-D Secure Check Failed\n\u2523\u2501\u2501\u2501\n\u2503 APPROVED CARDS (TAP TO COPY):\n4622391122136206|09|28|677\n5217293027071454|08|28|095';
const t2 = testSort(editorCards, checker2);
console.log('Format:', t2.format, '| cardStatus:', t2.cardStatusSize, '| last4Status:', t2.last4StatusSize);
t2.results.forEach(r => console.log(`  ${r.card} => ${r.status}`));
const t2v = t2.results.filter(r => r.status === 'valid').length;
const t2d = t2.results.filter(r => r.status === 'dead').length;
const t2u = t2.results.filter(r => r.status === 'unchecked').length;
console.log(`Counts: ${t2v} valid, ${t2d} dead, ${t2u} unchecked`);
console.log(t2v===3 && t2d===2 && t2u===3 ? 'PASS' : 'FAIL');
