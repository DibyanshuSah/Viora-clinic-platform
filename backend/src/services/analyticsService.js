const prisma = require('../config/prisma');
const { safeParse } = require('../utils/jsonUtils');

class AnalyticsService {
  async getAdminAnalytics(period = 'today', startDate, endDate) {
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
      filterStart = new Date(now);
      filterStart.setHours(0, 0, 0, 0);
      filterStart.setDate(now.getDate() - day + 1); // Monday
      filterEnd = new Date(filterStart);
      filterEnd.setHours(23, 59, 59, 999);
      filterEnd.setDate(filterStart.getDate() + 6);
    } else if (period === 'month') {
      filterStart = new Date(now.getFullYear(), now.getMonth(), 1);
      filterEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (period === 'custom' && startDate && endDate) {
      filterStart = new Date(startDate + 'T00:00:00.000Z');
      filterEnd = new Date(endDate + 'T23:59:59.999Z');
    } else {
      filterStart = new Date(todayStr + 'T00:00:00.000Z');
      filterEnd = new Date(todayStr + 'T23:59:59.999Z');
    }

    // Filter bills within selected period (excluding cancelled bills from revenue totals)
    const filteredBillsRaw = await prisma.bill.findMany({
      where: {
        createdAt: {
          gte: filterStart,
          lte: filterEnd
        },
        paymentStatus: { not: 'Cancelled' }
      }
    });

    const filteredBills = filteredBillsRaw.map(b => ({
      ...b,
      procedures: typeof b.procedures === 'string' ? safeParse(b.procedures, []) : (b.procedures || [])
    }));

    // High Level KPIs
    const totalRevenue = filteredBills.reduce((acc, b) => acc + (b.total || 0), 0);
    const totalDoctorPayout = filteredBills.reduce((acc, b) => acc + (b.doctorCutTotal || 0), 0);
    const totalClinicRevenue = filteredBills.reduce((acc, b) => acc + (b.clinicShareTotal || 0), 0);
    const totalPaidReceived = filteredBills.reduce((acc, b) => acc + (b.paid || 0), 0);
    const totalOutstanding = filteredBills.reduce((acc, b) => acc + (b.balance || 0), 0);

    // Period comparisons - Today's bills
    const todayStart = new Date(todayStr + 'T00:00:00.000Z');
    const todayEnd = new Date(todayStr + 'T23:59:59.999Z');
    const todayBills = await prisma.bill.findMany({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
        paymentStatus: { not: 'Cancelled' }
      }
    });
    const revenueToday = todayBills.reduce((acc, b) => acc + (b.total || 0), 0);

    // Patients registered
    const totalPatients = await prisma.patient.count();
    const patientsToday = await prisma.patient.count({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd }
      }
    });

    // Appointments summary
    const todayAppointments = await prisma.appointment.findMany({
      where: { date: todayStr }
    });
    const totalAppointmentsToday = todayAppointments.length;

    // Available doctors
    const doctors = await prisma.doctor.findMany();
    const availableDoctorsCount = doctors.filter(d => d.status === 'Active').length;

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
    const doctorPayouts = doctors.map(doc => {
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
    const staffMembers = await prisma.staff.findMany();
    const staffHours = staffMembers.map(st => ({
      staffId: st.staffId,
      name: st.name,
      shift: st.shift,
      scheduledHours: st.scheduledHours || 6,
      workedHours: st.workedHours || 6,
      attendance: st.attendance || 'Present',
      status: st.status
    }));

    const totalStaffHours = staffHours.reduce((acc, s) => acc + s.workedHours, 0);

    // Revenue Timeline for Charts (Last 7 days)
    const timeline = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const dStart = new Date(dStr + 'T00:00:00.000Z');
      const dEnd = new Date(dStr + 'T23:59:59.999Z');

      const dayBills = await prisma.bill.findMany({
        where: {
          createdAt: { gte: dStart, lte: dEnd },
          paymentStatus: { not: 'Cancelled' }
        }
      });
      const dayRev = dayBills.reduce((acc, b) => acc + (b.total || 0), 0);
      const dayDocCut = dayBills.reduce((acc, b) => acc + (b.doctorCutTotal || 0), 0);
      const dayClinicShare = dayBills.reduce((acc, b) => acc + (b.clinicShareTotal || 0), 0);
      const dayApts = await prisma.appointment.count({ where: { date: dStr } });

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
