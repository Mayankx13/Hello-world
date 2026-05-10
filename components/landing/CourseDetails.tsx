import {
  Calendar, BookOpen, Percent, IndianRupee,
  GraduationCap, Stethoscope, CheckCircle2, Award
} from 'lucide-react';
import { COLLEGE } from '@/config/states';

const FEE_BREAKDOWN = [
  { label: 'Tuition Fee', amount: '₹85,000/year', note: 'Academic instruction + labs + library' },
  { label: 'University Fee', amount: '₹10,000/year', note: 'Exam, registration, BFUHS charges' },
  { label: 'Hostel (All-Inclusive)', amount: `${COLLEGE.hostelFeePerYear}/year`, note: 'Room + meals + Wi-Fi + all amenities' },
  { label: 'One-Time Admission', amount: '₹15,000', note: 'Paid once at the time of joining' },
];

const SCHOLARSHIP_SCHEMES = [
  'Central Government — NSP Scholarships (SC/ST/OBC/Minority)',
  'State government scholarships (HP, J&K, Haryana, Delhi)',
  'Prime Minister Special Scholarship Scheme (J&K students)',
  'College Merit Scholarship — top 5% get 25% fee waiver',
  'Management quota scholarships for financially weaker students',
];

const CURRICULUM = [
  { year: 'Year 1', subjects: 'Anatomy, Physiology, Biochemistry, Nutrition, Nursing Foundations' },
  { year: 'Year 2', subjects: 'Medical-Surgical Nursing, Community Health, Pharmacology, Psychology' },
  { year: 'Year 3', subjects: 'Midwifery & Obstetrics, Child Health, Mental Health, Medical-Surgical Nursing II' },
  { year: 'Year 4', subjects: 'Nursing Research, Management, Internship (6 months), Community Practice' },
];

export default function CourseDetails() {
  return (
    <section className="py-14 px-4 bg-cream" id="course">
      <div className="max-w-6xl mx-auto">

        {/* Section header */}
        <div className="text-center mb-10">
          <span className="inline-block bg-accent/10 text-accent text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-3">
            Course Information
          </span>
          <h2 className="section-title">
            B.Sc Nursing — <span className="text-accent">4-Year Programme</span>
          </h2>
          <p className="section-subtitle">
            {COLLEGE.affiliation} · INC Approved · NMC Recognized
          </p>
        </div>

        {/* Key info cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { icon: Calendar, label: 'Duration', value: '4 Years', sub: '+ 6-month internship' },
            { icon: BookOpen, label: 'Seats', value: '60 / Batch', sub: 'Limited enrolment' },
            { icon: Percent, label: 'Eligibility', value: '45% in PCB', sub: '10+2 Biology stream' },
            { icon: IndianRupee, label: 'All-Inclusive', value: COLLEGE.totalFeeAllInclusive, sub: 'Per year · no hidden charges' },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-2xl p-4 shadow-card text-center">
              <div className="flex justify-center mb-2">
                <div className="bg-accent/10 p-2.5 rounded-xl">
                  <card.icon className="w-5 h-5 text-accent" />
                </div>
              </div>
              <div className="font-extrabold text-primary text-lg leading-tight">{card.value}</div>
              <div className="text-xs font-semibold text-primary/50 uppercase tracking-wide mt-0.5">{card.label}</div>
              <div className="text-xs text-primary/40 mt-1">{card.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Curriculum */}
          <div className="bg-white rounded-2xl p-6 shadow-card">
            <div className="flex items-center gap-2 mb-5">
              <Stethoscope className="w-5 h-5 text-accent" />
              <h3 className="font-bold text-primary">Year-wise Curriculum</h3>
            </div>
            <div className="space-y-3">
              {CURRICULUM.map((yr) => (
                <div key={yr.year} className="flex gap-3">
                  <div className="shrink-0 bg-accent/10 text-accent text-xs font-bold px-2.5 py-1 rounded-lg h-fit mt-0.5">
                    {yr.year}
                  </div>
                  <p className="text-sm text-primary/70 leading-relaxed">{yr.subjects}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Fee breakdown */}
          <div className="bg-white rounded-2xl p-6 shadow-card">
            <div className="flex items-center gap-2 mb-5">
              <IndianRupee className="w-5 h-5 text-accent" />
              <h3 className="font-bold text-primary">Transparent Fee Breakdown</h3>
            </div>
            <div className="space-y-3 mb-5">
              {FEE_BREAKDOWN.map((item) => (
                <div key={item.label} className="flex justify-between items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-primary">{item.label}</p>
                    <p className="text-xs text-primary/50">{item.note}</p>
                  </div>
                  <span className="text-sm font-bold text-accent shrink-0">{item.amount}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-primary/40 bg-cream rounded-lg p-2.5">
              💡 Installment plans available — quarterly or semester-wise. Scholarships adjusted directly.
            </p>
          </div>
        </div>

        {/* Scholarships */}
        <div className="mt-6 bg-white rounded-2xl p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-accent" />
            <h3 className="font-bold text-primary">Scholarships & Financial Aid</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {SCHOLARSHIP_SCHEMES.map((scheme) => (
              <div key={scheme} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                <p className="text-sm text-primary/70">{scheme}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Eligibility */}
        <div className="mt-6 bg-primary rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <GraduationCap className="w-10 h-10 text-accent shrink-0" />
          <div>
            <h3 className="font-bold text-white mb-1">Eligibility Criteria</h3>
            <div className="flex flex-wrap gap-3 text-sm">
              {[
                '10+2 with Physics, Chemistry, Biology',
                'Minimum 45% aggregate in PCB',
                'Age 17–35 years',
                'English proficiency helpful (not mandatory)',
              ].map((e) => (
                <span key={e} className="bg-white/10 text-white/80 px-3 py-1 rounded-full text-xs font-medium">
                  ✓ {e}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
