/**
 * Clinic Profile Entity Model
 */
class ClinicProfile {
  constructor({
    clinicName = "VIORA",
    tagline = "Advanced Clinic & Healthcare Centre",
    logoUrl = "",
    address,
    city = "Bengaluru",
    state = "Karnataka",
    pinCode = "560034",
    contactNumber = "+91 80 4920 8800",
    email = "contact@vioraclinic.com",
    website = "https://vioraclinic.com",
    registrationNumber = "KA-MED-2024-88421",
    gstNumber = "29AABCU9603R1ZM",
    openingTime = "08:00 AM",
    closingTime = "08:00 PM",
    currency = "₹",
    updatedAt = new Date().toISOString()
  }) {
    this.clinicName = clinicName;
    this.tagline = tagline;
    this.logoUrl = logoUrl;
    this.address = address;
    this.city = city;
    this.state = state;
    this.pinCode = pinCode;
    this.contactNumber = contactNumber;
    this.email = email;
    this.website = website;
    this.registrationNumber = registrationNumber;
    this.gstNumber = gstNumber;
    this.openingTime = openingTime;
    this.closingTime = closingTime;
    this.currency = currency;
    this.updatedAt = updatedAt;
  }
}

module.exports = ClinicProfile;
