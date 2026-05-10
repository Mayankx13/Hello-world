export type Testimonial = {
  id: string;
  name: string;
  hometown: string;
  district: string;
  batch: string;
  quote: string;
  photo: string; // SWAP: replace with /images/testimonials/<filename>.jpg
  videoUrl?: string; // SWAP: replace with real YouTube embed URL
  currentEmployer?: string;
};

export type FAQ = {
  question: string;
  answer: string;
};

export type StateConfig = {
  slug: 'himachal' | 'jammu' | 'haryana' | 'delhi';
  displayName: string;
  regionalScript: string;
  districts: string[];
  heroHeadline: string;
  heroSubheadEnglish: string;
  heroSubheadRegional: string;
  usps: { icon: string; title: string; desc: string }[];
  testimonials: Testimonial[];
  faqs: FAQ[];
  heroImage: string; // SWAP: replace with /images/hero-<slug>.jpg (1200x675 WebP)
  ogImage: string;   // SWAP: replace with /images/og-<slug>.jpg (1200x630)
  whatsappNumber: string; // College WhatsApp number with country code, e.g. "919876543210"
  whatsappPrefill: string; // Prefilled message template — {name} and {state} are replaced at runtime
  metaTitle: string;
  metaDescription: string;
};

// ─── College constants (update once, reflects everywhere) ────────────────────
export const COLLEGE = {
  name: 'Desh Bhagat Nursing College',
  shortName: 'DBNC',
  address: 'Mandi Gobindgarh Road, Fatehgarh Sahib, Punjab — 140406',
  phone: '+91 98222 00000',
  whatsapp: '919822200000',
  email: 'admissions@dbnc.edu.in',
  website: 'https://dbnc.edu.in',
  mapUrl: 'https://maps.google.com/?q=Fatehgarh+Sahib+Punjab',
  socialInstagram: 'https://instagram.com/dbnc_official',
  socialFacebook: 'https://facebook.com/dbnc.official',
  socialYoutube: 'https://youtube.com/@dbnc_official',
  // Stats
  studentsPlaced: '1,200+',
  batchesGraduated: '8',
  hostelCapacity: '300',
  placementRate: '98%',
  // Financials
  hostelFeePerYear: '₹72,000',
  courseFeePerYear: '₹95,000',
  totalFeeAllInclusive: '₹1,67,000',
  // Accreditation
  affiliation: 'Baba Farid University of Health Sciences',
  approvals: ['INC Approved', 'NMC Recognized', 'BFUHS Affiliated'],
};

export const stateConfigs: Record<string, StateConfig> = {
  // ─── HIMACHAL PRADESH ────────────────────────────────────────────────────
  himachal: {
    slug: 'himachal',
    displayName: 'Himachal Pradesh',
    regionalScript: 'हिमाचल प्रदेश',
    heroImage: 'https://picsum.photos/seed/dbnc-hero-himachal/1600/900',
    ogImage: 'https://picsum.photos/seed/dbnc-og-himachal/1200/630',
    whatsappNumber: COLLEGE.whatsapp,

    districts: [
      'Shimla', 'Mandi', 'Kangra', 'Una', 'Solan', 'Bilaspur',
      'Hamirpur', 'Chamba', 'Kullu', 'Sirmaur', 'Lahaul & Spiti', 'Kinnaur',
    ],

    heroHeadline: 'Top B.Sc Nursing College for Himachal Students — Safe Hostel, Punjab Campus',
    heroSubheadEnglish: 'INC approved · Close to home · Pahadi student community · 98% placements',
    heroSubheadRegional: 'हिमाचल की बेटियों के लिए — सुरक्षित हॉस्टल, बेहतरीन भविष्य',

    whatsappPrefill:
      'Namaste! My name is {name} and I am from {state}. I want to know more about B.Sc Nursing admissions, hostel facilities, and fee structure. Please call me back. 🙏',

    metaTitle: 'B.Sc Nursing Admissions for Himachal Students | INC Approved | Safe Hostel Punjab',
    metaDescription:
      'Top B.Sc Nursing college in Punjab for Himachal Pradesh students. Easy connectivity from Shimla, Mandi, Kangra. Safe girls hostel, INC approved. Apply 2025.',

    usps: [
      {
        icon: '🚌',
        title: 'Easy Connectivity',
        desc: 'Direct buses & trains from Shimla, Mandi, Kangra, Una, Hamirpur. Reach campus in 3–5 hours.',
      },
      {
        icon: '🌿',
        title: 'Familiar Climate',
        desc: 'Punjab\'s pleasant climate — no extreme heat. You\'ll feel right at home on our green campus.',
      },
      {
        icon: '🤝',
        title: 'Pahadi Student Community',
        desc: 'A thriving Himachal student community on campus. Festivals, language, and culture — just like home.',
      },
      {
        icon: '🏥',
        title: 'Government Job Pipeline',
        desc: 'Strong track record of placements in HP govt hospitals, AIIMS Bilaspur, and IGMC Shimla.',
      },
      {
        icon: '💰',
        title: 'State Scholarship Accepted',
        desc: 'Himachal Pradesh scholarship schemes accepted. Our counsellors help you apply.',
      },
      {
        icon: '📞',
        title: 'Dedicated HP Coordinator',
        desc: 'Dedicated student coordinator from HP handles admissions, travel, and homesickness support.',
      },
    ],

    testimonials: [
      {
        id: 'hp-1',
        name: 'Priya Sharma',
        hometown: 'Mandi',
        district: 'Mandi',
        batch: '2022',
        quote:
          'Coming from Mandi, I was nervous about leaving home. But the hostel felt like family from day one. The wardens are like mothers, and my pahadi friends here made everything easy. I\'m now posted at AIIMS Bilaspur!',
        photo: 'https://picsum.photos/seed/dbnc-priya-sharma/400/400',
        currentEmployer: 'AIIMS Bilaspur',
      },
      {
        id: 'hp-2',
        name: 'Sunita Thakur',
        hometown: 'Dharamshala',
        district: 'Kangra',
        batch: '2021',
        quote:
          'The bus from Dharamshala took just 4 hours. Weekend trips home were easy. The faculty is excellent and the hostel food — especially the rajma-chawal — felt like home cooking. Best decision of my life!',
        photo: 'https://picsum.photos/seed/dbnc-sunita-thakur/400/400',
        currentEmployer: 'Fortis Hospital, Chandigarh',
        videoUrl: 'https://www.youtube.com/embed/PLACEHOLDER_HP', // SWAP with real testimonial video
      },
      {
        id: 'hp-3',
        name: 'Meena Chauhan',
        hometown: 'Una',
        district: 'Una',
        batch: '2023',
        quote:
          'Una is only 2 hours away, so I could go home every weekend. The NCLEX preparation classes helped me plan my international nursing career. I\'m already preparing for my UK nursing license now.',
        photo: 'https://picsum.photos/seed/dbnc-meena-chauhan/400/400',
        currentEmployer: 'Civil Hospital, Una',
      },
    ],

    faqs: [
      {
        question: 'Is the hostel safe for girls from Himachal?',
        answer:
          'Absolutely. Our hostel has 24/7 CCTV coverage, female wardens on every floor, biometric entry, visitor log, and a strict in-time policy. Parents can visit during designated visiting hours. Over 80 students from Himachal Pradesh currently live in our hostel.',
      },
      {
        question: 'How do I travel from Shimla or Mandi to the campus?',
        answer:
          'From Shimla: Take the Kalka-Chandigarh train/bus (2.5 hrs) then connect to our campus (45 min). From Mandi: Direct HRTC buses reach Chandigarh, then local transport to campus. From Kangra/Dharamshala: ~4–5 hrs by road. We provide a travel guide and airport pickup support on admission.',
      },
      {
        question: 'What is the hostel fee and what does it include?',
        answer:
          `Hostel fee is ${COLLEGE.hostelFeePerYear}/year, fully all-inclusive: room, three meals a day, Wi-Fi, laundry, power backup, RO water, medical room access, and study room. No hidden charges.`,
      },
      {
        question: 'Are there scholarships available for HP students?',
        answer:
          'Yes. Himachal Pradesh government scholarships (SC/ST/OBC/Minority) are accepted. We also have merit scholarships. Our dedicated HP coordinator helps you with paperwork at no extra charge.',
      },
      {
        question: 'What is the admission process and documents required?',
        answer:
          '1) Fill the online form (this page) or call us. 2) Submit documents: 10th marksheet, 12th (PCB) marksheet, Domicile certificate, Aadhar, passport photos. 3) Counselling call. 4) Seat reservation with token fee. Documents checklist sent immediately after form submission.',
      },
      {
        question: 'Is there a language barrier? Do teachers teach in Hindi?',
        answer:
          'No language barrier at all. Classes are conducted in Hindi and English. Most faculty are North Indian and comfortable in Hindi. Regional Himachali terms are understood. You\'ll feel at home.',
      },
      {
        question: 'What food is served in the hostel mess?',
        answer:
          'Home-style North Indian vegetarian and non-vegetarian meals — roti, dal, sabzi, rice, curd. Special Himachali dishes like Siddu and Dham are prepared during festivals. No food from outside is necessary.',
      },
      {
        question: 'Can I go home on weekends or holidays?',
        answer:
          'Yes, with prior leave application and warden approval. Girls from Una, Solan, and nearby districts often go home on weekends. Shimla and Mandi students typically go home monthly. Leave policy is practical and student-friendly.',
      },
      {
        question: 'What is the eligibility criteria?',
        answer:
          '10+2 with Physics, Chemistry, Biology (PCB) with minimum 45% aggregate marks. Age: 17–35 years. English proficiency is beneficial but not mandatory for admission.',
      },
      {
        question: 'What government jobs can I get after B.Sc Nursing from HP?',
        answer:
          'Our graduates are regularly posted to AIIMS Bilaspur, IGMC Shimla, Tanda Medical College, and district hospitals across Himachal Pradesh. We provide HP government exam coaching as part of our placement support.',
      },
    ],
  },

  // ─── JAMMU ───────────────────────────────────────────────────────────────
  jammu: {
    slug: 'jammu',
    displayName: 'Jammu',
    regionalScript: 'जम्मू',
    heroImage: 'https://picsum.photos/seed/dbnc-hero-jammu/1600/900',
    ogImage: 'https://picsum.photos/seed/dbnc-og-jammu/1200/630',
    whatsappNumber: COLLEGE.whatsapp,

    districts: [
      'Jammu', 'Samba', 'Kathua', 'Udhampur', 'Reasi',
      'Rajouri', 'Poonch', 'Doda', 'Kishtwar', 'Ramban',
    ],

    heroHeadline: 'Top B.Sc Nursing College for Jammu Students — Safe Hostel, Punjab Campus',
    heroSubheadEnglish: 'Dedicated J&K cell · Scholarship support · Direct buses · Safe & close to home',
    heroSubheadRegional: 'जम्मू की बेटियों के लिए — सुरक्षित भविष्य, बेहतरीन करियर',

    whatsappPrefill:
      'Sat Sri Akal! My name is {name} and I am from {state} (Jammu region). I want to enquire about B.Sc Nursing admissions, J&K scholarship, and hostel. Please guide me. 🙏',

    metaTitle: 'B.Sc Nursing Admissions for Jammu Students | INC Approved College Punjab | J&K Scholarship',
    metaDescription:
      'Top B.Sc Nursing college near Jammu in Punjab. Dedicated J&K student cell, scholarship support, direct bus connectivity. Safe girls hostel. Apply 2025.',

    usps: [
      {
        icon: '🏛️',
        title: 'Dedicated J&K Student Cell',
        desc: 'A full-time J&K student coordinator helps with admissions, scholarships, travel, and on-campus support.',
      },
      {
        icon: '💰',
        title: 'J&K Scholarship Support',
        desc: 'We assist with JKBOPEE scholarships, Prime Minister\'s Special Scholarship Scheme (PMSSS), and minority schemes.',
      },
      {
        icon: '🚌',
        title: 'Direct Jammu–Punjab Buses',
        desc: 'JKSRTC and HRTC buses connect Jammu to Chandigarh daily. Campus is just 45 min from Chandigarh.',
      },
      {
        icon: '🏥',
        title: 'Safe Distance From Home',
        desc: 'Close enough to come home during breaks, far enough to experience independence and growth.',
      },
      {
        icon: '🤝',
        title: 'Dogra & Kashmiri Community',
        desc: 'Active Jammu & Kashmir student association on campus — festivals, Dogri songs, and home-style langar.',
      },
      {
        icon: '📋',
        title: 'Priority Seat for J&K',
        desc: 'Reserved counselling slots for Jammu students. Early applicants get priority in hostel room allotment.',
      },
    ],

    testimonials: [
      {
        id: 'jk-1',
        name: 'Reena Sharma',
        hometown: 'Jammu City',
        district: 'Jammu',
        batch: '2022',
        quote:
          'The J&K coordinator here helped me get the PMSSS scholarship, which covered 80% of my fees. The hostel is safer than I imagined — CCTV everywhere, kind wardens, and a strict entry policy. My parents were convinced on the first visit.',
        photo: 'https://picsum.photos/seed/dbnc-reena-sharma/400/400',
        currentEmployer: 'GMC Jammu',
      },
      {
        id: 'jk-2',
        name: 'Anjali Dogra',
        hometown: 'Udhampur',
        district: 'Udhampur',
        batch: '2021',
        quote:
          'From Udhampur the bus to Chandigarh is comfortable, and from there campus is 45 minutes. I went home for every major festival. The Dogra food day in our mess was my favourite — they made authentic Rajma and Kaladi cheese!',
        photo: 'https://picsum.photos/seed/dbnc-anjali-dogra/400/400',
        currentEmployer: 'Fortis Escorts, Amritsar',
        videoUrl: 'https://www.youtube.com/embed/PLACEHOLDER_JK', // SWAP with real video
      },
      {
        id: 'jk-3',
        name: 'Pooja Gupta',
        hometown: 'Kathua',
        district: 'Kathua',
        batch: '2023',
        quote:
          'Kathua to Punjab is just 2.5 hours. I was worried about safety as a first-time hostel girl, but the biometric gate and female warden gave my father complete peace of mind. Excellent faculty, great placement, and I cleared my NCLEX too!',
        photo: 'https://picsum.photos/seed/dbnc-pooja-gupta/400/400',
        currentEmployer: 'Apollo Hospitals, Delhi',
      },
    ],

    faqs: [
      {
        question: 'Is it safe for girls from Jammu to stay in the Punjab hostel?',
        answer:
          'Yes, absolutely. Our hostel has 24/7 CCTV, female wardens on every floor, biometric entry, visitor log, and strict in-time protocol. 40+ Jammu girls currently reside in our hostel. Parents visit regularly during visiting hours.',
      },
      {
        question: 'How do I travel from Jammu to the campus?',
        answer:
          'Daily JKSRTC Volvo buses run from Jammu Bus Stand to Chandigarh ISBT (6–7 hrs, overnight option available). From Chandigarh, our campus is 45 min by local bus/auto. We provide a complete travel guide on enrolment.',
      },
      {
        question: 'What J&K scholarships can I avail?',
        answer:
          'Our J&K cell helps students apply for: Prime Minister\'s Special Scholarship Scheme (PMSSS – up to ₹1.25 lakh/year), J&K state scholarships for SC/ST/OBC, Minority scholarships, and our college merit scholarship. Our coordinator handles the paperwork.',
      },
      {
        question: 'What is the last date for admission?',
        answer:
          'Admissions are rolling but seats fill quickly. The current batch closes once 60 seats are filled. Apply today to reserve your seat with a refundable token amount. Spot admission counselling is available via WhatsApp call.',
      },
      {
        question: 'Are documents from J&K accepted (domicile, marksheets)?',
        answer:
          'Yes. J&K domicile, JKBOSE marksheets, and CBSE (Jammu region) marksheets are all fully accepted. We have handled J&K student admissions since our first batch.',
      },
      {
        question: 'Is there any language problem for Dogri/Kashmiri speaking students?',
        answer:
          'No. Faculty teaches in Hindi and English. Dogri and Kashmiri are spoken and understood on campus. Several faculty members are from J&K themselves. You\'ll feel at home within the first week.',
      },
      {
        question: 'What food is served? Will I get North Indian food?',
        answer:
          'The mess serves home-style North Indian meals with Jammu specialties on regional food days: Rajma, Madra, Ambal, and rotis with pure ghee. Vegetarian and non-vegetarian both available.',
      },
      {
        question: 'Can I come home for holidays and festivals?',
        answer:
          'Yes. Leaves are granted for Diwali, Eid, Baisakhi, and semester breaks. With advance notice, weekend passes are issued. Udhampur and Kathua students often go home for weekends.',
      },
      {
        question: 'What is the fee structure and can it be paid in installments?',
        answer:
          `Course fee: ${COLLEGE.courseFeePerYear}/year. Hostel (all-inclusive): ${COLLEGE.hostelFeePerYear}/year. Installment plans available — semester-wise or quarterly payment accepted. Scholarship disbursements are adjusted directly.`,
      },
      {
        question: 'What career options are available after B.Sc Nursing?',
        answer:
          'Government hospitals (GMC Jammu, SMGS, District hospitals), Central govt (AIIMS, ESIC, Railways), Fortis/Apollo in Jammu/Punjab/Delhi, NCLEX for USA/UK/Canada nursing, and M.Sc Nursing at BFUHS. Our placement cell guides all options.',
      },
    ],
  },

  // ─── HARYANA ─────────────────────────────────────────────────────────────
  haryana: {
    slug: 'haryana',
    displayName: 'Haryana',
    regionalScript: 'हरियाणा',
    heroImage: 'https://picsum.photos/seed/dbnc-hero-haryana/1600/900',
    ogImage: 'https://picsum.photos/seed/dbnc-og-haryana/1200/630',
    whatsappNumber: COLLEGE.whatsapp,

    districts: [
      'Ambala', 'Kurukshetra', 'Karnal', 'Panipat', 'Sonipat',
      'Faridabad', 'Gurugram', 'Hisar', 'Rohtak', 'Sirsa',
      'Bhiwani', 'Rewari', 'Jhajjar', 'Palwal', 'Nuh',
      'Yamunanagar', 'Panchkula', 'Kaithal', 'Fatehabad',
      'Jind', 'Mahendragarh', 'Charkhi Dadri',
    ],

    heroHeadline: 'Top B.Sc Nursing College for Haryana Students — Weekend Home Trips, Punjab Campus',
    heroSubheadEnglish: 'Just 2–3 hrs drive · Weekend visits home · Haryana student association · 98% placements',
    heroSubheadRegional: 'हरियाणा की बेटियों के लिए — घर के पास, दमदार करियर',

    whatsappPrefill:
      'Jai Hind! My name is {name} from {state}. I want to enquire about B.Sc Nursing admissions, fee structure, hostel, and weekend leave policy. Please call me. 🙏',

    metaTitle: 'B.Sc Nursing Admissions for Haryana Students | 2–3 Hours Drive | Safe Hostel Punjab',
    metaDescription:
      'Top B.Sc Nursing college near Haryana in Punjab. Just 2–3 hrs by road. Weekend home visits possible. Haryana student association on campus. Apply 2025.',

    usps: [
      {
        icon: '🚗',
        title: '2–3 Hours Drive Home',
        desc: 'Ambala, Kurukshetra, Karnal — just 1.5–2 hrs. Even Rohtak and Faridabad are within 3 hrs via NH-44.',
      },
      {
        icon: '🏡',
        title: 'Weekend Home Visits',
        desc: 'Our weekend leave policy allows girls to go home every weekend with prior permission. Home every Sat–Sun possible for nearby districts.',
      },
      {
        icon: '👥',
        title: 'Haryana Student Association',
        desc: 'Active association on campus — Haryanvi festivals, Lohri, Teej celebrations. Strong alumni network in Haryana hospitals.',
      },
      {
        icon: '💰',
        title: 'Comparable to Haryana Govt Fees',
        desc: 'Our fee structure is on par with Haryana government nursing colleges — but with superior infrastructure and placement.',
      },
      {
        icon: '🏥',
        title: 'Placement in Haryana Hospitals',
        desc: 'Strong placement network: PGIMS Rohtak, Civil Hospital, Fortis Faridabad, and Medanta Gurugram.',
      },
      {
        icon: '🎓',
        title: 'Haryana Scholarship Accepted',
        desc: 'Haryana state SC/OBC/minority scholarships accepted. Our team helps you apply within 30 days of admission.',
      },
    ],

    testimonials: [
      {
        id: 'hr-1',
        name: 'Kavita Yadav',
        hometown: 'Ambala Cantt',
        district: 'Ambala',
        batch: '2022',
        quote:
          'Ambala to campus is barely 1.5 hours — I was home every other weekend. The hostel is incredibly well-maintained, mess food is just like home, and the faculty here prepared me for PGIMS Rohtak exam which I cleared in first attempt!',
        photo: 'https://picsum.photos/seed/dbnc-kavita-yadav/400/400',
        currentEmployer: 'PGIMS Rohtak',
      },
      {
        id: 'hr-2',
        name: 'Sonal Hooda',
        hometown: 'Karnal',
        district: 'Karnal',
        batch: '2021',
        quote:
          'I chose this college over Rohtak because the infrastructure and hostel are far better, fees are similar, and placements are stronger. My parents could visit every fortnight. Now I\'m working at Medanta and planning my M.Sc Nursing.',
        photo: 'https://picsum.photos/seed/dbnc-sonal-hooda/400/400',
        currentEmployer: 'Medanta Hospital, Gurugram',
        videoUrl: 'https://www.youtube.com/embed/PLACEHOLDER_HR', // SWAP with real video
      },
      {
        id: 'hr-3',
        name: 'Deepa Malik',
        hometown: 'Hisar',
        district: 'Hisar',
        batch: '2023',
        quote:
          'Even from Hisar (3.5 hrs) the journey was easy on the NH. The Haryana student group here is big — Lohri and Holi were celebrated just like back home. 4 of my batchmates from Hisar are already placed in AIIMS Jhajjar.',
        photo: 'https://picsum.photos/seed/dbnc-deepa-malik/400/400',
        currentEmployer: 'Civil Hospital, Hisar',
      },
    ],

    faqs: [
      {
        question: 'How far is the campus from major Haryana cities?',
        answer:
          'Ambala: ~1.5 hrs | Kurukshetra: ~1.5 hrs | Karnal: ~2 hrs | Panipat: ~2 hrs | Sonipat: ~2.5 hrs | Rohtak: ~2.5 hrs | Gurugram/Faridabad: ~3 hrs | Hisar: ~3.5 hrs. All via NH-44, a smooth 4-lane highway.',
      },
      {
        question: 'Can I go home every weekend?',
        answer:
          'Yes. Weekend passes are issued on Fridays for girls going home, returning by Sunday night. For girls from Ambala, Kurukshetra, Karnal — weekly home visits are routine. Farther districts (Hisar, Rohtak) usually go bi-weekly.',
      },
      {
        question: 'Are Haryana state scholarships accepted here?',
        answer:
          'Yes. Haryana SC/OBC/Minority scholarships are accepted and processed online through our accounts office. We help you submit the NSP portal application within the first month of admission.',
      },
      {
        question: 'How is this college better than Haryana nursing colleges?',
        answer:
          'Superior infrastructure and labs, stronger placement track record, better hostel facilities, NCLEX/international nursing prep, and a campus in Punjab with cleaner environment. Fees are comparable to Haryana government colleges.',
      },
      {
        question: 'Is the hostel safe? Can parents visit?',
        answer:
          'Yes. 24/7 CCTV, biometric entry, female wardens on all floors. Parents visit every Sunday during visiting hours (10 AM – 4 PM). 100+ Haryana girls live in our hostel currently.',
      },
      {
        question: 'What is the admission process and when should I apply?',
        answer:
          '1) Fill this form. 2) Counselling call within 24 hrs. 3) Document submission: 10th, 12th (PCB), domicile, Aadhar. 4) Seat confirmation with token fee. Haryana merit seat allocation typically closes by June–July.',
      },
      {
        question: 'What jobs can I get in Haryana after B.Sc Nursing?',
        answer:
          'PGIMS Rohtak, AIIMS Jhajjar, Civil Hospitals across Haryana, Fortis Faridabad, Medanta Gurugram, Max Healthcare. Haryana HPSC staff nurse exam coaching is part of our placement programme.',
      },
      {
        question: 'What is the fee structure?',
        answer:
          `Course fee: ${COLLEGE.courseFeePerYear}/year. Hostel (all-inclusive — meals, Wi-Fi, laundry, RO water, power backup): ${COLLEGE.hostelFeePerYear}/year. EMI options available semester-wise. Scholarship disbursements adjusted directly.`,
      },
      {
        question: 'Is there a language issue? Do faculty speak Haryanvi or Hindi?',
        answer:
          'Faculty teaches in Hindi and English. Many staff are from Haryana and speak Haryanvi. No language barrier whatsoever — most students say they felt at home within the first week.',
      },
      {
        question: 'What is the hostel food like?',
        answer:
          'Traditional North Indian home-style cooking: roti (fresh), dal tadka, sabzi, chaas, seasonal vegetables. Haryanvi specials like bajra ki khichdi and kachri sabzi are served during regional food days. Non-veg available on designated days.',
      },
    ],
  },

  // ─── DELHI ───────────────────────────────────────────────────────────────
  delhi: {
    slug: 'delhi',
    displayName: 'Delhi',
    regionalScript: 'दिल्ली',
    heroImage: 'https://picsum.photos/seed/dbnc-hero-delhi/1600/900',
    ogImage: 'https://picsum.photos/seed/dbnc-og-delhi/1200/630',
    whatsappNumber: COLLEGE.whatsapp,

    districts: [
      'New Delhi', 'North Delhi', 'South Delhi', 'East Delhi',
      'West Delhi', 'North East Delhi', 'North West Delhi',
      'South East Delhi', 'South West Delhi', 'Shahdara', 'Central Delhi',
    ],

    heroHeadline: 'Escape Delhi & Build Your Nursing Career — Punjab Campus, 30% Lower Fees',
    heroSubheadEnglish: 'Fresh air · Green campus · 30–40% lower fees than Delhi · 98% placements',
    heroSubheadRegional: 'दिल्ली की बेटियों के लिए — प्रदूषण से दूर, बेहतर भविष्य की ओर',

    whatsappPrefill:
      'Hello! My name is {name} from {state}. I want to know about B.Sc Nursing admission, fee comparison with Delhi colleges, hostel facilities, and placements. Please guide me. 🙏',

    metaTitle: 'B.Sc Nursing College for Delhi Students | 30% Lower Fees | Fresh Air Punjab Campus',
    metaDescription:
      'Top B.Sc Nursing college in Punjab for Delhi students. 30–40% lower fees, green campus, clean air, 98% placement. INC approved. 3–4 hrs from Delhi. Apply 2025.',

    usps: [
      {
        icon: '🌿',
        title: 'Escape NCR Pollution',
        desc: 'Study in clean Punjab air on a green 10-acre campus. No smog, no noise pollution — better focus, better health.',
      },
      {
        icon: '💸',
        title: '30–40% Lower Fees',
        desc: 'Equivalent Delhi nursing colleges charge ₹2.5–3 lakhs/year. Our all-inclusive fee is ₹1.67 lakhs/year. Save ₹3–5 lakhs over 4 years.',
      },
      {
        icon: '🚂',
        title: '3–4 Hours from Delhi',
        desc: 'Shatabdi Express Delhi–Chandigarh (3 hrs). From Chandigarh our campus is 45 min. Go home every month easily.',
      },
      {
        icon: '🏛️',
        title: 'Better Infrastructure',
        desc: 'Modern simulation labs, 200-bed attached hospital, spacious classrooms — vs. cramped urban Delhi colleges.',
      },
      {
        icon: '🏥',
        title: 'Delhi Placements Available',
        desc: 'Despite studying in Punjab, 35% of our graduates are placed in Delhi/NCR — AIIMS, Fortis, Apollo, Max, Safdarjung.',
      },
      {
        icon: '📱',
        title: 'NCLEX & International Pathway',
        desc: 'NCLEX preparation classes, IELTS coaching, and connections to recruiting agencies for USA, UK, Canada, and Gulf.',
      },
    ],

    testimonials: [
      {
        id: 'dl-1',
        name: 'Riya Sharma',
        hometown: 'Rohini',
        district: 'North West Delhi',
        batch: '2022',
        quote:
          'Delhi nursing colleges were charging ₹2.8 lakhs/year for the same course. Here, everything included is ₹1.67 lakhs. In 4 years, my parents saved over ₹4 lakhs. The clean campus air was a bonus — I stopped having asthma episodes!',
        photo: 'https://picsum.photos/seed/dbnc-riya-sharma/400/400',
        currentEmployer: 'AIIMS New Delhi',
      },
      {
        id: 'dl-2',
        name: 'Neha Jain',
        hometown: 'Laxmi Nagar',
        district: 'East Delhi',
        batch: '2021',
        quote:
          'I took the Shatabdi from Delhi and was at campus in 3.5 hrs. Coming from East Delhi, the pollution was constant. Here in Punjab, I studied better, slept better, and graduated with 87% marks. Now I\'m at Fortis Escorts Heart Institute.',
        photo: 'https://picsum.photos/seed/dbnc-neha-jain/400/400',
        currentEmployer: 'Fortis Escorts, Delhi',
        videoUrl: 'https://www.youtube.com/embed/PLACEHOLDER_DL', // SWAP with real video
      },
      {
        id: 'dl-3',
        name: 'Priti Verma',
        hometown: 'Dwarka',
        district: 'South West Delhi',
        batch: '2023',
        quote:
          'The NCLEX coaching here was excellent. I am now registered for the US NCLEX exam and have a conditional offer from a Houston hospital. None of my classmates at Delhi colleges got this opportunity. Worth every rupee.',
        photo: 'https://picsum.photos/seed/dbnc-priti-verma/400/400',
        currentEmployer: 'Preparing for NCLEX — USA pathway',
      },
    ],

    faqs: [
      {
        question: 'How far is the campus from Delhi and how do I get there?',
        answer:
          'Campus is ~270 km from Delhi. Travel options: Shatabdi Express Delhi–Chandigarh (3 hrs), then 45 min to campus by bus/taxi. Or direct Volvo bus from ISBT Kashmere Gate to Chandigarh (4–4.5 hrs). We arrange pickup from Chandigarh for new students.',
      },
      {
        question: 'How much cheaper is this compared to Delhi nursing colleges?',
        answer:
          `Private nursing colleges in Delhi charge ₹2.5–3.5 lakhs/year (course only, hostel extra). Our all-inclusive fee is ${COLLEGE.totalFeeAllInclusive}/year (course + hostel + meals + all amenities). Savings over 4 years: ₹3–6 lakhs.`,
      },
      {
        question: 'Will my B.Sc Nursing degree from Punjab be valid for Delhi jobs?',
        answer:
          'Yes, 100%. Our degree is from Baba Farid University of Health Sciences (BFUHS), recognized by INC and NMC. Valid for AIIMS Delhi, Safdarjung, RML, all private hospitals, and Delhi Nursing Council registration.',
      },
      {
        question: 'Is the hostel safe? Parents are concerned as it\'s far from Delhi.',
        answer:
          '24/7 CCTV, biometric-only entry, female wardens round the clock, visitor log, strict in-time, and regular parent communication via WhatsApp group. 50+ Delhi girls currently in our hostel — many parents now say it\'s safer than Delhi.',
      },
      {
        question: 'Can I visit home easily during the course?',
        answer:
          'Yes. Semester breaks, Diwali, Holi, summer holidays — ample time to visit Delhi. Shatabdi and Volvo buses run daily. Weekend trips are less frequent for Delhi girls (due to distance) but monthly visits are very common.',
      },
      {
        question: 'What is the admission process for Delhi students?',
        answer:
          '1) Fill this form. 2) Counselling call within 24 hrs. 3) Document submission: 10th, 12th (PCB), Aadhar, photos. 4) Seat reservation with token fee (refundable if not admitted). CBSE Delhi board marksheets accepted directly.',
      },
      {
        question: 'What placements are available in Delhi NCR after graduating?',
        answer:
          'AIIMS New Delhi, Safdarjung Hospital, RML, Fortis, Apollo Delhi, Max Healthcare, Medanta, and Artemis. Our placement cell has tie-ups with Delhi/NCR hospital HR departments. 35% of recent graduates are posted in NCR.',
      },
      {
        question: 'Is there NCLEX or international nursing preparation?',
        answer:
          'Yes. We offer NCLEX-RN preparation classes, IELTS coaching (for UK/Canada), and partnerships with international nursing recruiters. Several graduates are currently working in UK, Canada, and Middle East.',
      },
      {
        question: 'What about air quality and environment?',
        answer:
          'Fatehgarh Sahib, Punjab has AQI typically 40–80 (Good to Moderate) vs Delhi\'s 150–400+ (Unhealthy to Hazardous). Our campus is a green, clean space — many students report better health and focus after moving here.',
      },
      {
        question: 'Are Delhi board (CBSE) 12th marks accepted?',
        answer:
          'Yes. CBSE, ICSE, and all state board results are accepted. Minimum 45% aggregate in PCB (Physics, Chemistry, Biology) required. Delhi CBSE toppers often get merit scholarship from our college.',
      },
    ],
  },
};
