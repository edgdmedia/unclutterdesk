import React from 'react';
import { Link } from 'react-router-dom';

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#FCFDFE] text-[#0F172A] font-outfit p-8">
      <div className="max-w-[800px] mx-auto bg-white p-10 rounded-2xl shadow-sm border border-slate-200">
        <Link to="/" className="text-sm text-brand-primary font-bold hover:underline mb-8 inline-block">← Back to home</Link>
        <h1 className="text-3xl font-extrabold mb-6">Privacy Policy</h1>
        <div className="space-y-4 text-slate-600 text-[15px] leading-relaxed">
          <p>Last updated: August 2026</p>
          <h2 className="text-xl font-bold text-slate-800 mt-6 mb-2">1. Introduction</h2>
          <p>Welcome to Unclutter OS. We respect your privacy and are committed to protecting your personal data.</p>
          
          <h2 className="text-xl font-bold text-slate-800 mt-6 mb-2">2. Data We Collect</h2>
          <p>We may collect personal identification information (Name, email address, phone number, etc.) and calendar data when you explicitly connect third-party integrations such as Google Calendar.</p>

          <h2 className="text-xl font-bold text-slate-800 mt-6 mb-2">3. How We Use Your Data</h2>
          <p>We use your data to provide our scheduling and practice management services. Calendar data is used strictly to sync your appointments and check for availability conflicts. We do not sell your personal data.</p>
          
          <h2 className="text-xl font-bold text-slate-800 mt-6 mb-2">4. Third-Party Services</h2>
          <p>Unclutter OS uses Google Calendar APIs to sync your schedule. Our use of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.</p>

          <h2 className="text-xl font-bold text-slate-800 mt-6 mb-2">5. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, please contact us at support@unclutterdesk.com.</p>
        </div>
      </div>
    </div>
  );
}
