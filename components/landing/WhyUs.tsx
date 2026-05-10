import { StateConfig } from '@/config/states';

interface Props {
  config: StateConfig;
}

export default function WhyUs({ config }: Props) {
  return (
    <section className="bg-cream py-14 px-4" id="why-us">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="inline-block bg-accent/10 text-accent text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-3">
            State-Specific Advantages
          </span>
          <h2 className="section-title">
            Why {config.displayName} Students{' '}
            <span className="text-accent">Choose Us</span>
          </h2>
          <p className="section-subtitle max-w-xl mx-auto">
            We understand the specific needs of students from{' '}
            <span className="font-semibold text-primary">{config.displayName}</span> — from
            travel routes to scholarships to community support.
          </p>
        </div>

        {/* USP grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {config.usps.map((usp, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-5 shadow-card border border-gray-50 hover:shadow-form transition-shadow duration-200 group"
            >
              <div className="text-3xl mb-3">{usp.icon}</div>
              <h3 className="font-bold text-primary text-base mb-1.5 group-hover:text-accent transition-colors">
                {usp.title}
              </h3>
              <p className="text-primary/60 text-sm leading-relaxed">{usp.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA strip */}
        <div className="mt-10 bg-primary rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-white font-bold text-lg">Ready to secure your seat?</p>
            <p className="text-white/60 text-sm">
              Only {' '}
              <span className="text-accent font-bold">limited seats</span> available for{' '}
              {config.displayName} students in 2025 batch.
            </p>
          </div>
          <a href="#apply" className="btn-accent shrink-0 no-tap-highlight">
            Apply in 60 Seconds →
          </a>
        </div>
      </div>
    </section>
  );
}
