import fs from 'node:fs';

const path = new URL('../src/main.jsx', import.meta.url);
let text = fs.readFileSync(path, 'utf8');

if (!text.includes("import PaymentModal from './PaymentModal.jsx';")) {
  text = text.replace(
    "import './styles.css';",
    "import './styles.css';\nimport PaymentModal from './PaymentModal.jsx';"
  );
}

if (text.includes('function PaymentModal({ plan, onClose }) {')) {
  text = text.replace('function PaymentModal({ plan, onClose }) {', 'function LegacyPaymentModal({ plan, onClose }) {');
}

fs.writeFileSync(path, text);
console.log('[Klvro] Embedded payment UI applied.');
