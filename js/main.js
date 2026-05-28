// Load student counts from localStorage
function updateCounts() {
  const p5 = JSON.parse(localStorage.getItem('students_p5') || '[]');
  const p6 = JSON.parse(localStorage.getItem('students_p6') || '[]');
  const m4 = JSON.parse(localStorage.getItem('students_m4') || '[]');
  const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');

  const p5El = document.getElementById('p5-count');
  const p6El = document.getElementById('p6-count');
  const m4El = document.getElementById('m4-count');
  const totalEl = document.getElementById('total-students');
  const taskEl = document.getElementById('total-tasks');

  if (p5El) p5El.textContent = `👤 ${p5.length} คน`;
  if (p6El) p6El.textContent = `👤 ${p6.length} คน`;
  if (m4El) m4El.textContent = `👤 ${m4.length} คน`;
  if (totalEl) totalEl.textContent = p5.length + p6.length + m4.length;
  if (taskEl) taskEl.textContent = tasks.length;
}

document.addEventListener('DOMContentLoaded', updateCounts);
