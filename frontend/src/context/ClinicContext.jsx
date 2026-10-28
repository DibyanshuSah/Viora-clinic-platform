import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const ClinicContext = createContext(null);

export const ClinicProvider = ({ children }) => {
  const [clinic, setClinic] = useState({
    clinicName: "VIORA",
    tagline: "Advanced Clinic & Healthcare Centre",
    logoUrl: "",
    address: "42, Health Crest Boulevard, Medical Enclave, 4th Block, Koramangala",
    city: "Bengaluru",
    state: "Karnataka",
    pinCode: "560034",
    contactNumber: "+91 80 4920 8800",
    email: "contact@vioraclinic.com",
    website: "https://vioracare.in",
    registrationNumber: "KA-MED-2024-88421",
    gstNumber: "29AABCU9603R1ZM",
    openingTime: "08:00 AM",
    closingTime: "08:00 PM",
    currency: "₹"
  });
  const [loading, setLoading] = useState(false);

  const fetchClinicProfile = async () => {
    try {
      setLoading(true);
      const res = await api.getClinicProfile();
      if (res.success && res.data) {
        setClinic(res.data);
      }
    } catch (err) {
      console.error('Failed to load VIORA clinic profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateClinic = async (updatedData) => {
    try {
      const res = await api.updateClinicProfile(updatedData);
      if (res.success && res.data) {
        setClinic(res.data);
      }
      return res;
    } catch (err) {
      throw err;
    }
  };

  useEffect(() => {
    fetchClinicProfile();
  }, []);

  return (
    <ClinicContext.Provider value={{ clinic, loading, fetchClinicProfile, updateClinic }}>
      {children}
    </ClinicContext.Provider>
  );
};

export const useClinic = () => {
  const context = useContext(ClinicContext);
  if (!context) {
    throw new Error('useClinic must be used within a ClinicProvider');
  }
  return context;
};
