const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const drafts = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/after-sales-policies.json'))).items;

function app() {
  const nodes = new Map();
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, { value: '', hidden: false, dataset: {}, classList: {add(){},remove(){},toggle(){}}, listeners: {}, addEventListener(type, fn){ this.listeners[type] = fn; } });
    return nodes.get(id);
  }
  const copied = [];
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : ['2026-11-08T17:01:00Z'])); } }
  const context = vm.createContext({
    console, URLSearchParams, URL, Intl, Date: Clock, supportData: structuredClone(drafts),
    document: {querySelector: node,body:node('body')}, localStorage: { getItem(){return null}, setItem(){} },
    window: {location:{search:'?brand=TUTIMI&type=policy',pathname:'/'},history:{replaceState(){}}, clearTimeout(){},setTimeout(){}},
    navigator: {clipboard:{writeText: async text => copied.push(text)}}
  });
  const code = fs.readFileSync(path.join(root, 'public/script.js'), 'utf8').replace(/renderFilters\(\);\s*renderResults\(\);\s*bindEvents\(\);\s*loadSheetData\(\);\s*$/, '');
  vm.runInContext(code, context);
  return { run: code => vm.runInContext(code, context), nodes, copied };
}

test('18 draft situations, unique IDs and complete messages; none published automatically', () => {
  assert.equal(drafts.length,18);
  assert.equal(new Set(drafts.map(x=>x.id)).size,18);
  for (const item of drafts) {
    assert.equal(item.brand,'TUTIMI');
    assert.equal(item.policy.status,'draft');
    assert.equal(item.policy.effectiveDate,'');
    assert.ok(item.policy.resolution && item.policy.refund && item.policy.messages.length);
    assert.ok(item.policy.messages.every(m=>m.title && m.content));
  }
  const a=app();
  assert.equal(a.run('getFilteredItems().length'),0);
  assert.equal(a.run('state.showDrafts=true; getFilteredItems().length'),18);
});

test('effective day uses Vietnam time, future and undated policies stay hidden', () => {
  const a=app();
  a.run(`state.items = ['2026-11-09','2026-11-10',''].map((date,i) => ({...state.items[0], id:String(i),policy:{...state.items[0].policy,status:'active',effectiveDate:date}}));`);
  assert.equal(a.run('getFilteredItems().map(x=>x.id).join()'),'0');
});

test('dropdown selects one situation; category and brand filters compose', () => {
  const a=app();
  a.run("state.showDrafts=true;state.policyId='policy-tutimi-topping'");
  assert.equal(a.run('getFilteredItems().map(x=>x.id).join()'),'policy-tutimi-topping');
  a.run("state.category='Chất lượng'");
  assert.equal(a.run('getFilteredItems().length'),0);
  a.run('renderPolicySelect()');
  assert.equal(a.run('state.policyId'),'');
  assert.equal(a.run('getFilteredItems().length'),5);
  a.run("state.brand='SEKAI'");
  assert.equal(a.run('getFilteredItems().length'),0);
});

test('dropdown lists available situations and preserves a valid choice', () => {
  const a=app();
  a.run("state.showDrafts=true;state.policyId='policy-tutimi-wrong-item';renderPolicySelect()");
  const select=a.nodes.get('#policySelect');
  assert.equal(select.value,'policy-tutimi-wrong-item');
  assert.equal((select.innerHTML.match(/<option /g)||[]).length,19);
  a.run('state.showDrafts=false;renderPolicySelect()');
  assert.equal(select.value,'');
  assert.equal(select.disabled,true);
});

test('existing exact-title links migrate to dropdown selection', () => {
  const a=app();
  a.run("applyUrlState({brand:'TUTIMI',type:'policy',query:'Sai món / Thiếu món'})");
  assert.equal(a.run('state.policyId'),'policy-tutimi-wrong-item');
  assert.equal(a.run('state.query'),'');
});

test('refund templates retain the current MoMo / bank-account request', () => {
  for (const item of drafts) {
    const refund=item.policy.messages.find(m=>m.title === 'Lấy thông tin hoàn tiền (sau khi chốt phương án)');
    assert.ok(refund, item.id);
    assert.equal(refund.content,'Dạ mình vui lòng cung cấp giúp em số momo hoặc STK để bên em hoàn tiền cho mình nhé ạ.');
  }
});

test('gift wording is separate and staff can apply it under the confirmed policy', () => {
  for (const slug of ['wrong-item','topping','ice-request','stock']) {
    const policy=drafts.find(x=>x.id === 'policy-tutimi-'+slug).policy;
    assert.ok(!policy.messages[0].content.includes('tặng'));
    assert.ok(policy.messages.some(m=>m.title === 'Tặng topping theo chính sách' && m.content.includes('tặng')));
    assert.ok(policy.extra.includes('CSKH tự áp dụng'));
  }
});

test('confirmed cash support, three-month recurrence and final resolutions are explicit', () => {
  const get=slug=>drafts.find(x=>x.id==='policy-tutimi-'+slug).policy;
  assert.ok(get('repeat').verify.includes('3 tháng'));
  assert.ok(get('repeat').verify.includes('chi nhánh khác nhau'));
  for (const slug of ['repeat','utensils','late']) {
    assert.ok(get(slug).extra.includes('khoản hỗ trợ hoàn tiền'));
    assert.ok(get(slug).extra.includes('chính đơn đó hoặc đơn sau'));
    assert.ok(get(slug).extra.includes('tính trên số tiền khách thực trả của đơn sau'));
  }
  assert.ok(get('ice-request').refund.includes('50% tiền món bị ảnh hưởng'));
  for (const slug of ['taste','foreign']) {
    assert.ok(get(slug).refund.includes('hai phương án thay thế nhau'));
    assert.ok(get(slug).messages.some(m=>m.title.startsWith('Lấy thông tin đổi món')));
    assert.ok(!JSON.stringify(get(slug)).includes('CHỜ CHỐT'));
  }
  assert.ok(get('recipe').extra.includes('Không tự động cộng thêm khoản hỗ trợ 50%'));
  assert.ok(!JSON.stringify(get('recipe')).includes('CHỜ CHỐT'));
});

test('closing wording works for both refund and delivery; requests and checks remain separate', () => {
  for (const item of drafts) {
    const messages=item.policy.messages;
    assert.ok(messages.some(m=>m.title === 'Kiểm tra sau hỗ trợ'));
    const closing=messages.find(m=>m.title === 'Kết thúc hỗ trợ');
    assert.ok(closing);
    assert.ok(!closing.content.includes('Nhận đơn xong'));
    assert.ok(!messages.some(m=>m.content.includes('tuyệt đối không')));
  }
});

test('archived policies are excluded even in draft preview', () => {
  const a=app();
  assert.equal(a.run('state.showDrafts=true;state.items[0].archived=true;getFilteredItems().length'),17);
});

test('HTML from rules or messages is escaped and cards never copy internal rules', () => {
  const a=app();
  const html=a.run(`renderPolicies([{id:'x',title:'<script>bad()</script>',policy:{resolution:'<img src=x onerror=bad()>',messages:[{title:'<b>Title</b>',content:'<script>bad()</script>'}]}}])`);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('data-copy-row'));
  assert.ok(html.includes('data-copy-policy="x"'));
  assert.ok(html.includes('class="policy-message-text" role="button" tabindex="0" data-copy-policy="x"'));
});

test('copy selects only the requested chat, not another message or internal policy', async () => {
  const a=app();
  a.run('state.showDrafts=true;bindEvents()');
  const btn={dataset:{copyPolicy:'policy-tutimi-wrong-item',messageIndex:'1'}};
  a.nodes.get('#results').listeners.click({target:{closest: sel => sel==='[data-copy-policy]' ? btn : null}});
  await Promise.resolve();
  const expected=drafts.find(x=>x.id===btn.dataset.copyPolicy).policy.messages[1].content;
  assert.deepEqual(a.copied,[expected]);
  assert.ok(!a.copied[0].includes('Chuyển quản lý'));
});
