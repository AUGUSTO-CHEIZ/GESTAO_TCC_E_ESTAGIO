export default function StatusBadge({ status }) {
  const styles = {
    pendente: "bg-amber-100 text-amber-700",
    agendada: "bg-blue-100 text-blue-700",
    realizada: "bg-green-100 text-green-700",
    cancelada: "bg-red-100 text-red-700",
  };

  const labels = {
    pendente: "Pendente",
    agendada: "Agendada",
    realizada: "Realizada",
    cancelada: "Cancelada",
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.pendente}`}>
      {labels[status] || status}
    </span>
  );
}
