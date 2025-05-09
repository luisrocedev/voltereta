// public/js/employees.js
let internalToken = null;
const API_BASE = 'http://localhost:3000'; // Añadir base URL

export async function initEmployees(token) {
  internalToken = token;
  await loadEmployees();

  const addBtn = document.getElementById('employeeAddBtn');
  if (addBtn) {
    addBtn.addEventListener('click', createEmployee);
  }

  const saveEmpChangesBtn = document.getElementById('saveEmpChanges');
  if (saveEmpChangesBtn) {
    saveEmpChangesBtn.addEventListener('click', updateEmployee);
  }

  const closeEditEmpBtn = document.getElementById('closeEditEmpModal');
  if (closeEditEmpBtn) {
    closeEditEmpBtn.addEventListener('click', () => {
      const modal = document.getElementById('editEmployeeModal');
      if (modal) modal.close();
    });
  }
}

async function loadEmployees() {
  try {
    const resp = await fetch(`${API_BASE}/api/employees`, {
      headers: { 'Authorization': 'Bearer ' + internalToken }
    });
    const data = await resp.json();
    if (data.success) {
      const employeeList = document.getElementById('employeeList');
      if (employeeList) {
        employeeList.innerHTML = '';
        data.data.forEach(emp => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${emp.username}</td>
            <td>${emp.role}</td>
            <td>${emp.fullname || ''}</td>
            <td>${emp.email || ''}</td>
            <td>
              <button class="edit-emp-btn" data-id="${emp.id}"><i class="fa fa-edit"></i> Editar</button>
              <button class="delete-emp-btn" data-id="${emp.id}"><i class="fa fa-trash"></i> Eliminar</button>
            </td>
          `;
          employeeList.appendChild(tr);
        });

        document.querySelectorAll('.edit-emp-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const emp = data.data.find(e => e.id == id);
            if (emp) {
              openEditEmployeeModal(emp);
            }
          });
        });

        document.querySelectorAll('.delete-emp-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            if (confirm("¿Estás seguro de eliminar este empleado?")) {
              await deleteEmployee(id);
            }
          });
        });
      }
    }
  } catch (err) {
    console.error(err);
  }
}

async function createEmployee() {
  if (!internalToken) {
    alert('Error: sesión expirada o token no disponible. Por favor, vuelve a iniciar sesión.');
    window.location.href = 'login.html';
    return;
  }
  const usernameElem = document.getElementById('employeeUsername');
  const passwordElem = document.getElementById('employeePassword');
  const roleElem = document.getElementById('employeeRole');
  const fullnameElem = document.getElementById('employeeFullname');
  const emailElem = document.getElementById('employeeEmail');
  const profilePicElem = document.getElementById('employeeProfilePic');

  if (!usernameElem || !passwordElem || !roleElem) {
    console.error('Elementos obligatorios no encontrados.');
    return;
  }

  const username = usernameElem.value.trim();
  const password = passwordElem.value.trim();
  const role = roleElem.value;
  const fullname = fullnameElem ? fullnameElem.value.trim() : '';
  const email = emailElem ? emailElem.value.trim() : '';
  const profilePic = profilePicElem ? profilePicElem.value.trim() : '';

  if (!username || !password || !role) {
    alert("Faltan datos obligatorios: usuario, contraseña o rol.");
    return;
  }

  try {
    const body = {
      username,
      password,
      role,
      fullname,
      email,
      profile_pic: profilePic ? profilePic : null
    };
    const resp = await fetch(`${API_BASE}/api/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + internalToken
      },
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    if (data.success) {
      usernameElem.value = '';
      passwordElem.value = '';
      roleElem.value = '';
      if (fullnameElem) fullnameElem.value = '';
      if (emailElem) emailElem.value = '';
      if (profilePicElem) profilePicElem.value = '';
      await loadEmployees();
    } else {
      if (data.errors) {
        const msgs = data.errors.map(err => err.msg).join("\n");
        alert(msgs);
      } else {
        alert(data.message || 'Error desconocido al crear empleado');
      }
    }
  } catch (err) {
    console.error(err);
  }
}

function openEditEmployeeModal(employee) {
  const editEmpId = document.getElementById('editEmpId');
  const editEmpUsername = document.getElementById('editEmpUsername');
  const editEmpRole = document.getElementById('editEmpRole');
  const editEmpFullname = document.getElementById('editEmpFullname');
  const editEmpEmail = document.getElementById('editEmpEmail');
  if (editEmpId && editEmpUsername && editEmpRole) {
    editEmpId.value = employee.id;
    editEmpUsername.value = employee.username;
    editEmpRole.value = employee.role;
    if (editEmpFullname) editEmpFullname.value = employee.fullname || '';
    if (editEmpEmail) editEmpEmail.value = employee.email || '';
    const modal = document.getElementById('editEmployeeModal');
    if (modal) modal.showModal();
  }
}

async function updateEmployee() {
  const id = document.getElementById('editEmpId').value;
  const username = document.getElementById('editEmpUsername').value.trim();
  const role = document.getElementById('editEmpRole').value;
  const fullname = document.getElementById('editEmpFullname').value.trim();
  const email = document.getElementById('editEmpEmail').value.trim();

  if (!username || !role) {
    alert("Faltan datos obligatorios en el formulario de edición.");
    return;
  }

  try {
    const resp = await fetch(`${API_BASE}/api/employees/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + internalToken
      },
      body: JSON.stringify({ username, role, fullname, email })
    });
    const data = await resp.json();
    if (data.success) {
      const modal = document.getElementById('editEmployeeModal');
      if (modal) modal.close();
      await loadEmployees();
    } else {
      if (data.errors) {
        const msgs = data.errors.map(err => err.msg).join("\n");
        alert(msgs);
      } else {
        alert(data.message || 'Error desconocido al actualizar empleado');
      }
    }
  } catch (err) {
    console.error(err);
  }
}

async function deleteEmployee(id) {
  try {
    const resp = await fetch(`${API_BASE}/api/employees/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer ' + internalToken
      }
    });
    const data = await resp.json();
    if (data.success) {
      await loadEmployees();
    } else {
      alert(data.message);
    }
  } catch (err) {
    console.error(err);
  }
}
