/**
 * VIORA Centralized API Client Service
 */

const API_BASE_URL = '/api/v1';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('viora_auth_token') || null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('viora_auth_token', token);
    } else {
      localStorage.removeItem('viora_auth_token');
    }
  }

  getToken() {
    if (!this.token) {
      this.token = localStorage.getItem('viora_auth_token');
    }
    return this.token;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = this.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    const config = {
      ...options,
      headers
    };

    try {
      const res = await fetch(url, config);
      const data = await res.json().catch(() => ({
        success: false,
        message: 'Invalid JSON response from VIORA server'
      }));

      if (!res.ok) {
        if (res.status === 401) {
          // Token expired or invalid
          this.setToken(null);
          localStorage.removeItem('viora_auth_user');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
        throw new Error(data.message || `HTTP Error ${res.status}`);
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  }

  get(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${endpoint}?${query}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  post(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  put(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  patch(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // --- DOMAIN API METHODS ---

  // Auth
  async login(username, password) {
    const res = await this.post('/auth/login', { username, password });
    if (res.success && res.data.token) {
      this.setToken(res.data.token);
      localStorage.setItem('viora_auth_user', JSON.stringify(res.data.user));
    }
    return res;
  }

  async switchDemoRole(role) {
    const res = await this.post('/auth/switch-demo', { role });
    if (res.success && res.data.token) {
      this.setToken(res.data.token);
      localStorage.setItem('viora_auth_user', JSON.stringify(res.data.user));
    }
    return res;
  }

  getMe() {
    return this.get('/auth/me');
  }

  logout() {
    this.setToken(null);
    localStorage.removeItem('viora_auth_user');
  }

  // Clinic
  getClinicProfile() {
    return this.get('/clinic');
  }

  updateClinicProfile(data) {
    return this.put('/clinic', data);
  }

  // Doctors
  getDoctors() {
    return this.get('/doctors');
  }

  getDoctorById(id) {
    return this.get(`/doctors/${id}`);
  }

  createDoctor(data) {
    return this.post('/doctors', data);
  }

  updateDoctor(id, data) {
    return this.put(`/doctors/${id}`, data);
  }

  deleteDoctor(id) {
    return this.delete(`/doctors/${id}`);
  }

  // Staff
  getStaff() {
    return this.get('/staff');
  }

  getStaffById(id) {
    return this.get(`/staff/${id}`);
  }

  createStaff(data) {
    return this.post('/staff', data);
  }

  updateStaff(id, data) {
    return this.put(`/staff/${id}`, data);
  }

  deleteStaff(id) {
    return this.delete(`/staff/${id}`);
  }

  // Procedures
  getProcedures() {
    return this.get('/procedures');
  }

  createProcedure(data) {
    return this.post('/procedures', data);
  }

  updateProcedure(id, data) {
    return this.put(`/procedures/${id}`, data);
  }

  deleteProcedure(id) {
    return this.delete(`/procedures/${id}`);
  }

  // Patients
  getPatients(search = '') {
    return this.get('/patients', search ? { search } : {});
  }

  getPatientById(id) {
    return this.get(`/patients/${id}`);
  }

  createPatient(data) {
    return this.post('/patients', data);
  }

  updatePatient(id, data) {
    return this.put(`/patients/${id}`, data);
  }

  // Appointments & Schedules
  getAppointments(filters = {}) {
    return this.get('/appointments', filters);
  }

  getDoctorSchedules(date) {
    return this.get('/schedules/doctors', date ? { date } : {});
  }

  createAppointment(data) {
    return this.post('/appointments', data);
  }

  updateAppointmentStatus(id, status) {
    return this.patch(`/appointments/${id}/status`, { status });
  }

  cancelAppointment(id) {
    return this.delete(`/appointments/${id}`);
  }

  // Consultations
  getConsultations(filters = {}) {
    return this.get('/consultations', filters);
  }

  getConsultationById(id) {
    return this.get(`/consultations/${id}`);
  }

  saveConsultation(data) {
    return this.post('/consultations', data);
  }

  getPatientHistory(patientId) {
    return this.get(`/consultations/patient/${patientId}/history`);
  }

  // Prescriptions
  getPrescriptions(filters = {}) {
    return this.get('/prescriptions', filters);
  }

  getPrescriptionById(id) {
    return this.get(`/prescriptions/${id}`);
  }

  createPrescription(data) {
    return this.post('/prescriptions', data);
  }

  // Billing & Invoices
  getBills(filters = {}) {
    return this.get('/billing', filters);
  }

  getBillById(id) {
    return this.get(`/billing/${id}`);
  }

  createBill(data) {
    return this.post('/billing', data);
  }

  updateBillPayment(id, data) {
    return this.patch(`/billing/${id}/payment`, data);
  }

  connectedRegisterAndBill(data) {
    return this.post('/billing/connected-register-bill', data);
  }

  getInvoice(id) {
    return this.get(`/invoices/${id}`);
  }

  // Analytics (Admin Only)
  getAdminAnalytics(period = 'today', startDate = '', endDate = '') {
    return this.get('/analytics', { period, startDate, endDate });
  }
}

export const api = new ApiService();
export default api;
