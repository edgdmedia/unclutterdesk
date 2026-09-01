import React from 'react';
import { Link } from 'react-router-dom';
import { UnclutterLockup } from '@unclutterdesk/ui';

export function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-outfit p-6 sm:p-10 flex flex-col items-center">
      <div className="w-full max-w-[860px] mb-8 flex justify-between items-center">
        <UnclutterLockup variant="light" markSize={28} />
        <Link to="/" className="text-sm text-[#0F3A53] font-bold hover:underline">← Back to home</Link>
      </div>

      <div className="w-full max-w-[860px] bg-white p-8 sm:p-12 rounded-[24px] shadow-sm border border-slate-200">
        <h1 className="text-[32px] font-extrabold tracking-tight text-[#0F172A] mb-2">Terms of Service</h1>
        <p className="text-sm text-slate-500 font-medium mb-10">Last updated: August 2026</p>
        
        <div className="space-y-8 text-[#475569] text-[15px] leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">1. Acceptance of Terms</h2>
            <p>By accessing and using Unclutter OS ("the Platform"), you accept and agree to be bound by the terms and provisions of this agreement. The Platform is a B2B SaaS software designed to assist independent clinical professionals ("Therapists", "Practices") with scheduling, billing, and administrative practice management.</p>
          </section>
          
          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">2. No Medical Advice or Clinical Relationship</h2>
            <p className="font-semibold text-rose-800 bg-rose-50 p-4 rounded-xl border border-rose-100">
              Unclutter OS is strictly a technology provider. We do not provide medical, psychological, or clinical advice, diagnosis, or treatment. The Platform does not establish a doctor-patient or therapist-client relationship between Unclutter OS and any end-user (client/patient). All clinical relationships exist solely between the Therapist and their client.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">3. Therapist Responsibilities and Warranties</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>You represent and warrant that you possess all necessary licenses, certifications, and qualifications required by your local jurisdiction to provide the telehealth and clinical services you offer.</li>
              <li>You are solely responsible for the quality, accuracy, and legality of the medical or clinical advice, diagnoses, and treatments provided to your clients.</li>
              <li>You are responsible for obtaining appropriate consent from your clients before providing telehealth services or collecting health information.</li>
              <li>You agree to use the service only for lawful purposes. You are responsible for all data you upload and for maintaining the confidentiality of your account.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">4. Indemnification</h2>
            <p className="font-bold text-[#0F172A] uppercase text-xs tracking-wider mb-2">Read Carefully</p>
            <p>
              You agree to fully indemnify, defend, and hold harmless Unclutter OS, its officers, directors, employees, and agents, from and against any and all claims, liabilities, damages, losses, costs, expenses, or fees (including reasonable attorneys' fees) arising from:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Your provision of medical, psychological, or clinical services (or failure to provide such services).</li>
              <li>Any malpractice, negligence, or misconduct claims brought against you by your clients or third parties.</li>
              <li>Your violation of any applicable health care laws, regulations, or licensing requirements.</li>
              <li>Your breach of these Terms of Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">5. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, in no event shall Unclutter OS be liable for any indirect, punitive, incidental, special, consequential, or exemplary damages, including without limitation damages for loss of profits, goodwill, use, data, or other intangible losses, that result from the use of, or inability to use, this service. 
            </p>
            <p className="mt-2">
              Unclutter OS bears absolutely no liability for any clinical outcomes, health deteriorations, or personal injuries resulting from the services provided by Therapists utilizing our Platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">6. Disclaimer of Warranties</h2>
            <p>The service is provided "as is" and "as available" without warranty of any kind, either express or implied, including but not limited to the implied warranties of merchantability, fitness for a particular purpose, and non-infringement.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#0F172A] mb-3">7. Modifications to Service</h2>
            <p>Unclutter OS provides scheduling, billing, and practice management tools. We reserve the right to modify or discontinue the service (or any part thereof) temporarily or permanently, with or without notice at any time.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
