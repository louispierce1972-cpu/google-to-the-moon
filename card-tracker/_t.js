
window.addEventListener('load', () => setTimeout(() => {
  document.querySelector('.tn-tab[data-view="new-cards"]').click();
  const geos = ['DE','DE','DE','NL','NL','RS','US','US','FR'];
  PARSER_STATE.collected = geos.map((g, i) => ({ cc: '4' + String(100000000000000 + i), bin: '4' + String(10000 + (i % 3)), mm: '01', yy: '29', cvv: '123', name: 'A', surname: 'B', bank: 'Bank' + g, validity: '01/29', detectedGeo: g }));
  document.querySelector('.pz-wrap, #content-area').insertAdjacentHTML('beforeend', '<div id="parser-results"></div>');
  PARSER_STATE.selected = new Set();
  renderParserResults();
  document.title = 'T:ready';
}, 1500));
