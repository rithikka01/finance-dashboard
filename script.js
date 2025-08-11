// script.js - HushBudget
const STORAGE_KEY = 'hushbudget_tx_v1';
const THEME_KEY = 'hushbudget_theme_v1';

const form = document.getElementById('tx-form');
const descIn = document.getElementById('desc');
const amountIn = document.getElementById('amount');
const categoryIn = document.getElementById('category');
const dateIn = document.getElementById('date');
const txList = document.getElementById('tx-list');
const balanceValue = document.getElementById('balance-value');
const noTx = document.getElementById('no-tx');

const exportBtn = document.getElementById('export-csv');
const themeToggle = document.getElementById('theme-toggle');

let transactions = [];
// Charts
let pieChart = null;
let lineChart = null;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    transactions = raw ? JSON.parse(raw) : [];
  } catch (e) {
    transactions = [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

// Helpers
function fmtCurrency(v) {
  try {
    return new Intl.NumberFormat('en-IN', {style:'currency', currency:'INR'}).format(v);
  } catch {
    return `₹${v.toFixed(2)}`;
  }
}

function renderTransactions() {
  txList.innerHTML = '';
  if (!transactions.length) {
    noTx.style.display = 'block';
    updateBalance();
    updateCharts();
    return;
  }
  noTx.style.display = 'none';

  // sort by date desc
  const sorted = [...transactions].sort((a,b)=> new Date(b.date) - new Date(a.date));
  sorted.forEach(tx => {
    const li = document.createElement('li');
    li.className = 'tx-item';
    li.innerHTML = `
      <div class="tx-left">
        <div class="tx-desc">${tx.description}</div>
        <div class="tx-meta">${tx.category} • ${new Date(tx.date).toLocaleDateString()}</div>
      </div>
      <div class="tx-right">
        <div class="tx-amount">${fmtCurrency(tx.amount)}</div>
        <button class="btn-del" data-id="${tx.id}" title="Delete">✕</button>
      </div>
    `;
    txList.appendChild(li);

    li.querySelector('.btn-del').addEventListener('click', (e)=>{
      const id = e.currentTarget.dataset.id;
      transactions = transactions.filter(t => String(t.id) !== String(id));
      save();
      renderTransactions();
    });
  });

  updateBalance();
  updateCharts();
}

function updateBalance() {
  const sum = transactions.reduce((s,t)=> s + Number(t.amount), 0);
  balanceValue.textContent = fmtCurrency(sum);
  balanceValue.style.color = sum >= 0 ? 'var(--success)' : 'var(--danger)';
}

function getCategoryTotals() {
  const totals = {};
  transactions.forEach(t => {
    const cat = t.category || 'Other';
    totals[cat] = (totals[cat] || 0) + (t.amount < 0 ? Math.abs(t.amount) : 0); // only spending
  });
  return totals;
}

function getMonthlyBalances() {
  // returns map of 'YYYY-MM' -> balance up to that month
  const byDate = [...transactions].slice().sort((a,b)=> new Date(a.date)-new Date(b.date));
  const months = {};
  let running = 0;
  byDate.forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    running += Number(t.amount);
    months[key] = running;
  });
  // if months empty, return current month with 0
  return months;
}

function updateCharts() {
  // Pie chart (category)
  const catTotals = getCategoryTotals();
  let labels = Object.keys(catTotals);
  let data = Object.values(catTotals);

  if (!labels.length) {
    labels = ['No data']; data = [1];
  }

  if (!pieChart) {
    const ctx = document.getElementById('pieChart').getContext('2d');
    pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: [
            '#6366f1','#06b6d4','#f97316','#ef4444','#10b981','#8b5cf6','#f59e0b'
          ],
          borderWidth:0
        }]
      },
      options: {
        responsive:true,
        plugins:{legend:{position:'bottom'}}
      }
    });
  } else {
    pieChart.data.labels = labels;
    pieChart.data.datasets[0].data = data;
    pieChart.update();
  }

  // Line chart (balance over time)
  const monthsMap = getMonthlyBalances();
  const mLabels = Object.keys(monthsMap);
  const mData = Object.values(monthsMap);

  if (!lineChart) {
    const ctx2 = document.getElementById('lineChart').getContext('2d');
    lineChart = new Chart(ctx2, {
      type: 'line',
      data: {
        labels: mLabels.length ? mLabels : ['Now'],
        datasets:[{
          label:'Balance',
          data: mData.length ? mData : [0],
          fill:true,
          tension:0.35,
          borderWidth:2,
          backgroundColor:'rgba(79,70,229,0.08)',
          borderColor:'#4f46e5',
          pointRadius:3
        }]
      },
      options:{responsive:true, plugins:{legend:{display:false}}}
    });
  } else {
    lineChart.data.labels = mLabels.length ? mLabels : ['Now'];
    lineChart.data.datasets[0].data = mData.length ? mData : [0];
    lineChart.update();
  }
}

// add transaction
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const desc = descIn.value.trim();
  const amount = parseFloat(amountIn.value);
  const category = categoryIn.value;
  const date = dateIn.value;

  if (!desc || Number.isNaN(amount) || !date) return alert('Please fill all fields');

  const tx = {
    id: Date.now(),
    description: desc,
    amount: Number(amount),
    category,
    date
  };

  transactions.push(tx);
  save();
  renderTransactions();

  // reset form (keep category)
  descIn.value = '';
  amountIn.value = '';
  dateIn.value = '';
  descIn.focus();
});

// export CSV
exportBtn.addEventListener('click', ()=>{
  if (!transactions.length) return alert('No transactions to export.');
  const headers = ['id','description','amount','category','date'];
  const rows = transactions.map(t => headers.map(h => `"${String(t[h]).replace(/"/g,'""')}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'transactions.csv';
  a.click();
  URL.revokeObjectURL(url);
});

// theme
function applyTheme(theme){
  if(theme === 'dark') document.body.classList.add('dark');
  else document.body.classList.remove('dark');
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(THEME_KEY, theme);
}
themeToggle.addEventListener('click', ()=>{
  const cur = document.body.classList.contains('dark') ? 'dark' : 'light';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
});

// init
(function init(){
  // set default date to today
  dateIn.value = new Date().toISOString().slice(0,10);

  // load theme
  const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(savedTheme);

  load();
  renderTransactions();
})();
