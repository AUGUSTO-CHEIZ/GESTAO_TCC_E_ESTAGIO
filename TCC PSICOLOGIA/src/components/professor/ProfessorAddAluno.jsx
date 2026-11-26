import { useState } from 'react';
import { adicionarAlunoUltimaHora } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { X, UserPlus } from 'lucide-react';

export default function ProfessorAddAluno({ banca, onClose, onAdded }) {
  const [form, setForm] = useState({
    tipo: 'academico', nome: '', email: '', cpf: '',
    codigo_academico: '', curso: 'Psicologia', semestre: '', parentesco: ''
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nome || !form.email) {
      toast({ title: 'Nome e e-mail obrigatórios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await adicionarAlunoUltimaHora({
        banca_id: banca.id,
        ...form
      });
      if (res.data?.error) {
        toast({ title: 'Erro', description: res.data.error, variant: 'destructive' });
      } else {
        toast({ title: 'Aluno adicionado!', description: 'Aluno marcado como presente.' });
        onAdded();
      }
    } catch (e) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-900">Adicionar Aluno - Última Hora</h3>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <p className="text-sm text-slate-500 mb-4">Banca: {banca.titulo_tcc}</p>

        <div className="mb-4">
          <Label className="mb-2 block">Tipo *</Label>
          <div className="grid grid-cols-3 gap-2">
            {[{ v: 'academico', l: 'Acadêmico' }, { v: 'familiar', l: 'Familiar' }, { v: 'apresentador', l: 'Apresentador' }].map((t) => (
              <button
                key={t.v}
                type="button"
                onClick={() => setForm({ ...form, tipo: t.v })}
                className={`p-2 rounded-lg border-2 text-sm transition ${form.tipo === t.v ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200'}`}
              >
                {t.l}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>E-mail *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <Label>CPF</Label>
              <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
            </div>
          </div>
          {form.tipo === 'academico' && (
            <div>
              <Label>Código Acadêmico / Matrícula</Label>
              <Input value={form.codigo_academico} onChange={(e) => setForm({ ...form, codigo_academico: e.target.value })} placeholder="Ex: 2024123456" />
            </div>
          )}
          {form.tipo === 'academico' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Curso</Label>
                <Input value={form.curso} onChange={(e) => setForm({ ...form, curso: e.target.value })} />
              </div>
              <div>
                <Label>Semestre</Label>
                <Input value={form.semestre} onChange={(e) => setForm({ ...form, semestre: e.target.value })} />
              </div>
            </div>
          )}
          {form.tipo === 'familiar' && (
            <div>
              <Label>Parentesco</Label>
              <Input value={form.parentesco} onChange={(e) => setForm({ ...form, parentesco: e.target.value })} placeholder="Ex: Pai, Mãe..." />
            </div>
          )}
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? 'Adicionando...' : 'Adicionar e Marcar Presente'}
          </Button>
        </form>
      </div>
    </div>
  );
}
