import { TrendingUp, Globe, Award, ArrowRight } from 'lucide-react';
import { COLLEGE } from '@/config/states';

const RECRUITERS = [
  { name: 'AIIMS', type: 'Govt' },
  { name: 'Fortis Hospitals', type: 'Private' },
  { name: 'Apollo Hospitals', type: 'Private' },
  { name: 'Max Healthcare', type: 'Private' },
  { name: 'Medanta', type: 'Private' },
  { name: 'PGIMS Rohtak', type: 'Govt' },
  { name: 'Safdarjung Hospital', type: 'Govt' },
  { name: 'Manipal Hospitals', type: 'Private' },
  { name: 'ESIC Hospitals', type: 'Govt' },
  { name: 'Railways Health', type: 'Govt' },
  { name: 'Artemis', type: 'Private' },
  { name: 'Civil Hospitals', type: 'Govt' },
];

const STATS = [
  { value: COLLEGE.placementRate, label: 'Placement Rate', sub: 'within 6 months of graduation' },
  { value: '₹25,000–₹45,000', label: 'Starting Salary', sub: 'per month (govt & private)' },
  { value: '40+', label: 'Hospital Partners', sub: 'across India & abroad' },
  { value: '8', label: 'International Placements', sub: 'USA, UK, Canada, Gulf' },
];

const PATHWAYS = [
  {
    title: 'Government Jobs',
    icon: '🏛️',
    desc: 'AIIMS, ESIC, Railways, state civil hospitals. Coaching for HPSC, Delhi, Haryana, J&K staff nurse exams included.',
  },
  {
    title: 'Top Private Hospitals',
    icon: '🏥',
    desc: 'Campus recruitment by Fortis, Apollo, Max, Medanta, Manipal every year. Starting salary ₹30,000–₹45,000/month.',
  },
  {
    title: 'NCLEX — USA/Canada',
    icon: '✈️',
    desc: 'NCLEX-RN preparation classes on campus. Tie-ups with US/Canada recruiting agencies. Starting salary $60,000–$90,000/year abroad.',
  },
  {
    title: 'UK/Gulf Nursing',
    icon: '🌍',
    desc: 'OSCE preparation for UK NMC, CBT coaching for Gulf hospitals. IELTS coaching available on campus.',
  },
  {
    title: 'Higher Education',
    icon: '📚',
    desc: 'M.Sc Nursing, Nurse Practitioner, MBA in Healthcare. BFUHS post-graduate programmes have priority for our graduates.',
  },
];

export default function Placements() {
  return (
    <section className="py-14 px-4 bg-white" id="placements">
      <div className="max-w-6xl mx-auto">

        {/* Section header */}
        <div className="text-center mb-10">
          <span className="inline-block bg-accent/10 text-accent text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-3">
            Career Outcomes
          </span>
          <h2 className="section-title">
            Placements &amp; <span className="text-accent">Career Pathways</span>
          </h2>
          <p className="section-subtitle">
            {COLLEGE.placementRate} of our graduates are placed within 6 months — in India and abroad.
          </p>
        </div>

        {/* Placement stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {STATS.map((stat) => (
            <div key={stat.label} className="bg-cream rounded-2xl p-4 text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-primary">{stat.value}</div>
              <div className="text-sm font-semibold text-primary/70 mt-1">{stat.label}</div>
              <div className="text-xs text-primary/40 mt-0.5">{stat.sub}</div>
            </div>
          ))}
        </div>

        {/* Career pathways */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {PATHWAYS.map((p) => (
            <div key={p.title} className="bg-white rounded-2xl p-5 shadow-card border border-gray-50 hover:shadow-form transition-shadow">
              <div className="text-3xl mb-3">{p.icon}</div>
              <h3 className="font-bold text-primary mb-2">{p.title}</h3>
              <p className="text-sm text-primary/60 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>

        {/* Top recruiters */}
        <div className="bg-cream rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <Award className="w-5 h-5 text-accent" />
            <h3 className="font-bold text-primary">Our Top Recruiters</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {RECRUITERS.map((r) => (
              <span
                key={r.name}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                  r.type === 'Govt'
                    ? 'bg-blue-50 text-blue-700 border-blue-100'
                    : 'bg-orange-50 text-orange-700 border-orange-100'
                }`}
              >
                {r.name}
                <span className="ml-1.5 text-xs opacity-60">{r.type}</span>
              </span>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-primary/40">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-200 inline-block" />
              Government
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-200 inline-block" />
              Private
            </span>
          </div>
        </div>

        {/* International pathway banner */}
        <div className="mt-6 bg-primary rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Globe className="w-10 h-10 text-accent shrink-0" />
            <div>
              <p className="text-white font-bold text-lg">Dream of Working Abroad?</p>
              <p className="text-white/60 text-sm">
                Our NCLEX &amp; OSCE coaching has sent 8 nurses to USA, UK &amp; Gulf so far.
                Ask our counsellor about the international nursing pathway.
              </p>
            </div>
          </div>
          <a
            href="#apply"
            className="btn-accent shrink-0 flex items-center gap-2 no-tap-highlight"
          >
            Explore Pathways <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
