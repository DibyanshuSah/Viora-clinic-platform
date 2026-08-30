const db = require('../config/database');

class AnalyticsService {
  getAdminAnalytics(period = 'today', startDate, endDate) {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Compute date ranges
    let filterStart = new Date();
    let filterEnd = new Date();

    if (period === 'today') {
      filterStart = new Date(todayStr + 'T00:00:00.000Z');
      filterEnd = new Date(todayStr + 'T23:59:59.999Z');
    } else if (period === 'week') {
      const day = now.getDay() || 7; // get current day of week (1-7)
      filterStart.setHours(0, 0, 0, 0);
      filterStart.setDate(now.getDate() - day + 1); // Monday
      filterEnd.setHours(23, 59, 59, 999);
      filterEnd.setDate(filterStart.getDate() + 6);
    } else if (period === 'month') {
      filterStart = new Date(now.getFullYear(), now.getMonth(), 1);
      filterEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (period === 'custom' && startDate && endDate) {
      filterStart = new Date(startDate + 'T00:00:00.000Z');
      filterEnd = new Date(endDate + 'T23:59:59.999Z');
    } else {
      // Default to today
      filterStart = new Date(todayStr + 'T00:00:00.000Z');
      filterEnd = new Date(todayStr + 'T23:59:59.999Z');
    }

    // Filter bills within selected period
    const filteredBills = db.bills.filter(b => {
      const bDate = new Date(b.createdAt);
      return bDate >= filterStart && bDate <= filterEnd;
    });

    // High Level KPIs
    const totalRevenue = filteredBills.reduce((acc, b) => acc + (b.total || 0), 0);
    const totalDoctorPayout = filteredBills.reduce((acc, b) => acc + (b.doctorCutTotal || 0), 0);
    const totalClinicRevenue = filteredBills.reduce((acc, b) => acc + (b.clinicShareTotal || 0), 0);
    const totalPaidReceived = filteredBills.reduce((acc, b) => acc + (b.paid || 0), 0);
    const totalOutstanding = filteredBills.reduce((acc, b) => acc + (b.balance || 0), 0);

    // Period comparisons
    const todayBills = db.bills.filter(b => b.createdAt.startsWith(todayStr));
    const revenueToday = todayBills.reduce((acc, b) => acc + (b.total || 0), 0);

    // Patients registered
    const totalPatients = db.patients.length;
    const patientsToday = db.patients.filter(p => p.createdAt.startsWith(todayStr)).length;

    // Appointments summary
    const todayAppointments = db.appointments.filter(a => a.date === todayStr);
    const totalAppointmentsToday = todayAppointments.length;
    const availableDoctorsCount = db.doctors.filter(d => d.status === 'Active').length;

    // Breakdown: Consultations vs Procedures
    let consultationRevenue = 0;
    let procedureRevenue = 0;
    let consultationCount = 0;
    let procedureCount = 0;

    filteredBills.forEach(b => {
      if (b.consultationFee > 0) {
        consultationRevenue += b.consultationFee;
        consultationCount += 1;
      }
      if (b.procedures && b.procedures.length > 0) {
        b.procedures.forEach(p => {
          procedureRevenue += p.amount || 0;
          procedureCount += p.qty || 1;
        });
      }
    });

    // Revenue and Payout per Doctor
    const doctorPayouts = db.doctors.map(doc => {
      const docBills = filteredBills.filter(b => b.doctorId === doc.doctorId);
      const grossRevenue = docBills.reduce((acc, b) => acc + (b.total || 0), 0);
      const docCut = docBills.reduce((acc, b) => acc + (b.doctorCutTotal || 0), 0);
      const clinicShare = docBills.reduce((acc, b) => acc + (b.clinicShareTotal || 0), 0);

      let docConsultations = 0;
      let docProcedures = 0;
      docBills.forEach(b => {
        if (b.consultationFee > 0) docConsultations++;
        if (b.procedures) docProcedures += b.procedures.length;
      });

      return {
        doctorId: doc.doctorId,
        doctorName: doc.name,
        specialization: doc.specialization,
        consultations: docConsultations,
        procedures: docProcedures,
        grossRevenue,
        doctorCut: docCut,
        clinicShare,
        amountPayable: docCut
      };
    });

    // Staff working hours & attendance
    const staffHours = db.staff.map(st => ({
      staffId: st.staffId,
      name: st.name,
      shift: st.shift,
      scheduledHours: st.scheduledHours || 6,
      workedHours: st.workedHours || 6,
      attendance: st.attendance || 'Present',
      status: st.status
    }));

    const totalStaffHours = staffHours.reduce((acc, s) => acc + s.workedHours, 0);

    // Revenue Timeline for Charts (Last 7 days or points in period)
    const timeline = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const dayBills = db.bills.filter(b => b.createdAt.startsWith(dStr));
      const dayRev = dayBills.reduce((acc, b) => acc + (b.total || 0), 0);
      const dayDocCut = dayBills.reduce((acc, b) => acc + (b.doctorCutTotal || 0), 0);
      const dayClinicShare = dayBills.reduce((acc, b) => acc + (b.clinicShareTotal || 0), 0);
      const dayApts = db.appointments.filter(a => a.date === dStr).length;

      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      timeline.push({
        date: dStr,
        label: dayLabel,
        revenue: dayRev,
        doctorCut: dayDocCut,
        clinicShare: dayClinicShare,
        appointments: dayApts
      });
    }

    return {
      period,
      summary: {
        totalRevenue,
        revenueToday,
        totalDoctorPayout,
        totalClinicRevenue,
        totalPaidReceived,
        totalOutstanding,
        totalConsultations: consultationCount,
        totalProcedures: procedureCount,
        consultationRevenue,
        procedureRevenue,
        totalPatients,
        patientsToday,
        totalAppointmentsToday,
        availableDoctorsCount,
        totalStaffHours
      },
      doctorPayouts,
      staffHours,
      timeline,
      breakdown: {
        consultationRevenue,
        procedureRevenue,
        doctorPayout: totalDoctorPayout,
        clinicShare: totalClinicRevenue
      }
    };
  }
}

module.exports = new AnalyticsService();
