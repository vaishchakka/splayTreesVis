import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './App.css';

/* StrictMode is omitted: double-mounting would duplicate animation controls in dev. */
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
