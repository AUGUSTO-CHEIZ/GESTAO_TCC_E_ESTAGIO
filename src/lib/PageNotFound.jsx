import { Link } from 'react-router-dom';

export default function PageNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="text-center">
        <p className="text-7xl font-bold text-indigo-600 mb-4">404</p>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Página não encontrada</h1>
        <p className="text-slate-500 mb-6">A página que você está procurando não existe.</p>
        <Link to="/" className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
