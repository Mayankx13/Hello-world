// =============================================================
// State configuration — single source of truth for copy/data.
// Swap content here; the same JS renders all 4 landing pages.
// =============================================================

window.STATE_CONFIGS = {
  himachal: {
    slug: 'himachal',
    displayName: 'Himachal Pradesh',
    heroSubheadEnglish:
      'Direct buses from Shimla, Mandi, Kangra & Una. Pleasant Punjab climate, pahadi student community.',
    heroSubheadRegional:
      'शिमला, मंडी, कांगड़ा और ऊना से सीधी बस सेवा। पंजाब का सुहावना मौसम, अपने पहाड़ी साथियों के साथ।',
    heroImage: '../assets/images/hero/himachal-hero.svg',
    whatsappPrefill:
      'Hi! I am from Himachal Pradesh and want B.Sc Nursing admission details + hostel info.',
    districts: [
      'Shimla','Mandi','Kangra','Una','Hamirpur','Bilaspur','Solan',
      'Sirmaur','Kullu','Chamba','Kinnaur','Lahaul-Spiti',
    ],
    usps: [
      'Easy bus & train connectivity from Shimla, Mandi, Kangra, Una',
      'Pleasant Punjab climate — no extreme heat or harsh winters',
      'Strong pahadi student community and HP cultural club on campus',
      'HP-specific scholarship guidance from our admissions cell',
      'Domicile certificate accepted for state quota benefits',
    ],
    testimonials: [
      {
        name: 'Aanchal Thakur', hometown: 'Mandi, HP', batchYear: 'Batch of 2024',
        quote: 'The hostel feels like home. My parents visit from Mandi every two months and the wardens treat them like family.',
        photo: '../assets/images/testimonials/himachal-1.svg',
      },
      {
        name: 'Priya Rana', hometown: 'Shimla, HP', batchYear: 'Batch of 2023',
        quote: 'Got placed at Fortis right after final year. The clinical exposure here is unmatched in our region.',
        photo: '../assets/images/testimonials/himachal-2.svg',
      },
      {
        name: 'Nidhi Sharma', hometown: 'Kangra, HP', batchYear: 'Batch of 2025',
        quote: 'Direct Volvo from Kangra to campus. Travel is the easiest part of college life.',
        photo: '../assets/images/testimonials/himachal-3.svg',
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      },
    ],
    faqs: [
      { q: 'How do I travel from Himachal to the Punjab campus?', a: 'Direct HRTC and PRTC Volvo buses run daily from Shimla, Mandi, Kangra, Una, and Hamirpur. Average journey is 5–8 hours. The campus is 15 minutes from the nearest bus stand and we offer pickup on first-day arrival.' },
      { q: 'How safe is the girls\' hostel?', a: '24/7 CCTV, biometric entry, female wardens on every floor, security at the gate, and a visitor log. Parents are welcome during posted visiting hours.' },
      { q: 'What documents are required for admission?', a: '10th & 12th marksheets, Aadhaar, 4 passport photos, transfer certificate, character certificate, and a domicile certificate (if claiming state quota).' },
      { q: 'When is the last date to apply?', a: 'Counselling begins after the 12th results. We recommend reserving your seat early — hostel allotment is first-come-first-served.' },
      { q: 'What is the all-inclusive hostel fee for HP students?', a: 'Approximately ₹85,000 per year — covers room, mess (veg + non-veg), laundry, Wi-Fi, RO water, and 24/7 power backup. No hidden charges.' },
      { q: 'What is the leave policy? Can I visit home on weekends?', a: 'Weekend home visits are allowed with parental consent. Long-leave requires a written request approved by the warden.' },
      { q: 'Is non-veg food available in the mess?', a: 'Yes — North Indian veg + non-veg menu, rotated weekly. Special menu on Sundays and festivals.' },
      { q: 'Will language be a barrier?', a: 'Classes are in English with Hindi explanations. Faculty is comfortable supporting students from across North India.' },
      { q: 'Will I get the HP State Government scholarship here?', a: 'Yes — our admissions cell helps process IRDP, Kalpana Chawla, and Dr. Ambedkar Medhavi Chhatravriti scholarships available to HP-domicile students.' },
    ],
    ogTitle: 'B.Sc Nursing Admission for Himachal Students | Safe Hostel + Punjab Campus',
    ogDescription: 'INC approved · NMC recognized. Direct buses from Shimla, Mandi, Kangra. 24/7 secure girls\' hostel. Reserve your seat today.',
  },

  jammu: {
    slug: 'jammu',
    displayName: 'Jammu',
    heroSubheadEnglish:
      'Dedicated J&K student cell, scholarship support, and direct Jammu–Punjab buses.',
    heroSubheadRegional:
      'जम्मू-कश्मीर के बच्चों के लिए विशेष सेल, स्कॉलरशिप सहायता और सीधी बस सेवा।',
    heroImage: '../assets/images/hero/jammu-hero.svg',
    whatsappPrefill: 'Hi! I am from Jammu and want B.Sc Nursing admission + PMSSS scholarship details.',
    districts: ['Jammu','Kathua','Samba','Udhampur','Reasi','Rajouri','Poonch','Doda','Kishtwar','Ramban'],
    usps: [
      'Dedicated J&K student welfare cell on campus',
      'PMSSS scholarship processing fully supported by our team',
      'Direct overnight buses from Jammu — safe, comfortable journey',
      'Safe distance from home with strong J&K alumni network',
      'Special orientation programme for first-year J&K students',
    ],
    testimonials: [
      { name: 'Ridhima Sharma', hometown: 'Jammu', batchYear: 'Batch of 2024', quote: 'The J&K cell helped me with PMSSS paperwork from day one. I never felt alone.', photo: '../assets/images/testimonials/jammu-1.svg' },
      { name: 'Nisha Devi', hometown: 'Udhampur, J&K', batchYear: 'Batch of 2023', quote: 'Hostel is genuinely safer than I expected. My mother slept in peace from the first night.', photo: '../assets/images/testimonials/jammu-2.svg' },
      { name: 'Simran Kour', hometown: 'Kathua, J&K', batchYear: 'Batch of 2025', quote: 'Got placed in a Delhi hospital with a starting salary I didn\'t imagine possible.', photo: '../assets/images/testimonials/jammu-3.svg' },
    ],
    faqs: [
      { q: 'How do I travel from Jammu to the campus?', a: 'Direct overnight Volvo and AC buses run daily from Jammu, Udhampur, and Kathua. Train: Jammu Tawi → Pathankot → campus. Travel time: 4–6 hours.' },
      { q: 'Do you support the PMSSS scholarship for J&K students?', a: 'Yes — our dedicated J&K cell handles PMSSS application, document verification, and disbursement coordination throughout your 4 years.' },
      { q: 'How safe is the girls\' hostel?', a: '24/7 CCTV, biometric entry, female wardens on every floor, security at the gate, and a visitor log. Parents are welcome during posted visiting hours.' },
      { q: 'What documents are required for admission?', a: '10th & 12th marksheets, Aadhaar/Domicile, 4 passport photos, TC, character certificate.' },
      { q: 'What is the all-inclusive hostel fee?', a: 'Approximately ₹85,000 per year — covers room, mess, laundry, Wi-Fi, RO water, and 24/7 power backup.' },
      { q: 'What is the leave policy?', a: 'Long weekend home visits are allowed with parental consent. We coordinate transport on big J&K festivals.' },
      { q: 'Is non-veg food available?', a: 'Yes — North Indian veg + non-veg menu, rotated weekly. Special menu on Sundays and festivals.' },
      { q: 'Will language be a barrier?', a: 'Classes are in English with Hindi explanations. Faculty supports students from across the region.' },
      { q: 'When is the last date to apply?', a: 'Counselling starts after 12th results. PMSSS applicants should reserve early — slots are limited.' },
    ],
    ogTitle: 'B.Sc Nursing Admission for J&K Students | PMSSS Support + Safe Hostel',
    ogDescription: 'Dedicated J&K cell · PMSSS support · Direct buses from Jammu. INC approved B.Sc Nursing in Punjab.',
  },

  haryana: {
    slug: 'haryana',
    displayName: 'Haryana',
    heroSubheadEnglish:
      'Just 2–3 hours from home. Weekend visits possible. Active Haryana student association on campus.',
    heroSubheadRegional:
      'ਘਰ ਤੋਂ ਸਿਰਫ਼ 2–3 ਘੰਟੇ। ਵੀਕਐਂਡ ਘਰ ਜਾਣਾ ਆਸਾਨ। ਕੈਂਪਸ ਵਿੱਚ ਹਰਿਆਣਾ ਵਿਦਿਆਰਥੀ ਸੰਘ।',
    heroImage: '../assets/images/hero/haryana-hero.svg',
    whatsappPrefill: 'Hi! I am from Haryana and want B.Sc Nursing admission + hostel details.',
    districts: [
      'Ambala','Panchkula','Yamunanagar','Kurukshetra','Karnal','Panipat',
      'Sonipat','Rohtak','Hisar','Sirsa','Fatehabad','Jind','Kaithal',
      'Faridabad','Gurugram','Rewari','Mahendragarh',
    ],
    usps: [
      'Just 2–3 hours from Ambala, Karnal, Panipat — weekend visits possible',
      'Active Haryana student association — homely community on campus',
      'Direct Haryana Roadways buses from every major district',
      'Same food, language, and culture — zero adjustment shock',
      'Haryana state quota and scholarship processing supported',
    ],
    testimonials: [
      { name: 'Pooja Saini', hometown: 'Karnal, Haryana', batchYear: 'Batch of 2024', quote: 'I go home every alternate weekend. Karnal to campus is just a 2-hour drive. Best of both worlds.', photo: '../assets/images/testimonials/haryana-1.svg' },
      { name: 'Ritu Yadav', hometown: 'Rewari, Haryana', batchYear: 'Batch of 2023', quote: 'Cleared NCLEX with the campus prep program. Now starting my career abroad.', photo: '../assets/images/testimonials/haryana-2.svg' },
      { name: 'Manisha Dhillon', hometown: 'Hisar, Haryana', batchYear: 'Batch of 2025', quote: 'The Haryana association celebrates Lohri and Teej together. Feels like home, only with new friends.', photo: '../assets/images/testimonials/haryana-3.svg' },
    ],
    faqs: [
      { q: 'How long to reach campus from my district?', a: 'Ambala: 1.5 hrs · Karnal/Panipat: 2.5 hrs · Hisar/Rohtak: 3 hrs · Gurugram/Faridabad: 5 hrs. Direct Haryana Roadways and private Volvos run daily.' },
      { q: 'Can I get admission under Haryana state quota?', a: 'You can apply through both management and state quota. We assist with domicile-based scholarships and CET counselling parallel applications.' },
      { q: 'How safe is the girls\' hostel?', a: '24/7 CCTV, biometric entry, female wardens, security at gate. Parents welcome during posted visiting hours.' },
      { q: 'What documents are required?', a: '10th & 12th marksheets, Aadhaar, 4 passport photos, TC, character certificate, domicile certificate (for state quota).' },
      { q: 'What is the all-inclusive hostel fee?', a: '₹85,000 per year — covers room, mess (veg + non-veg), laundry, Wi-Fi, RO water, and 24/7 backup.' },
      { q: 'Can I visit home on weekends?', a: 'Yes — weekend home visits with parental consent. Many Haryana students go home alternate weekends.' },
      { q: 'Is non-veg food available?', a: 'Yes — North Indian veg + non-veg menu, rotated weekly. Special menu on Sundays.' },
      { q: 'Will language be a barrier?', a: 'No — Punjabi/Hindi is spoken on campus alongside English. You\'ll feel right at home.' },
      { q: 'When is the last date to apply?', a: 'Counselling starts after 12th results. Hostel allotment is first-come-first-served — reserve early.' },
    ],
    ogTitle: 'B.Sc Nursing Admission for Haryana Students | 2–3 Hours from Home',
    ogDescription: 'Weekend visits possible. Active Haryana student community. INC approved B.Sc Nursing with secure hostel in Punjab.',
  },

  delhi: {
    slug: 'delhi',
    displayName: 'Delhi NCR',
    heroSubheadEnglish:
      'Escape NCR pollution. 30–40% lower fees than Delhi colleges. Clean campus, fresh air, focused study.',
    heroSubheadRegional:
      'NCR के प्रदूषण से दूर — स्वच्छ हवा, कम फीस और बेहतर पढ़ाई का माहौल।',
    heroImage: '../assets/images/hero/delhi-hero.svg',
    whatsappPrefill: 'Hi! I am from Delhi NCR and want B.Sc Nursing admission + fee comparison details.',
    districts: [
      'Central Delhi','New Delhi','North Delhi','South Delhi','East Delhi',
      'West Delhi','North-East Delhi','North-West Delhi','South-East Delhi',
      'South-West Delhi','Shahdara','Noida','Ghaziabad','Gurugram','Faridabad',
    ],
    usps: [
      'Escape NCR air pollution — clean Punjab air, healthier student life',
      '30–40% lower fees than comparable Delhi nursing colleges',
      'Direct Volvos from ISBT Kashmere Gate — 5–6 hour journey',
      'Focused, non-distracting study environment vs. metro chaos',
      'Same INC/NMC recognition and placement opportunities',
    ],
    testimonials: [
      { name: 'Sneha Gupta', hometown: 'Rohini, Delhi', batchYear: 'Batch of 2024', quote: 'My asthma improved within a month of moving here. Clean air, peaceful campus, no AQI alerts.', photo: '../assets/images/testimonials/delhi-1.svg' },
      { name: 'Tanya Verma', hometown: 'Dwarka, Delhi', batchYear: 'Batch of 2023', quote: 'Got the same Apollo placement my Delhi cousin got — but I paid 35% less in fees over 4 years.', photo: '../assets/images/testimonials/delhi-2.svg' },
      { name: 'Khushi Aggarwal', hometown: 'Noida', batchYear: 'Batch of 2025', quote: 'ISBT to campus is one Volvo ride. I go home for every long weekend without stress.', photo: '../assets/images/testimonials/delhi-3.svg' },
    ],
    faqs: [
      { q: 'How do I travel from Delhi NCR to the campus?', a: 'Direct AC Volvo from ISBT Kashmere Gate runs every 30 minutes. Time: 5–6 hours. Trains via New Delhi → Ludhiana also available with campus pickup.' },
      { q: 'Why should I leave Delhi for nursing?', a: '(1) Cleaner air = healthier study years, (2) 30–40% lower total fees over 4 years, (3) Same INC/NMC recognition and same hospital placements.' },
      { q: 'How safe is the girls\' hostel?', a: '24/7 CCTV, biometric entry, female wardens, security at the gate, visitor log. Parents welcome during posted visiting hours.' },
      { q: 'What documents are required?', a: '10th & 12th marksheets, Aadhaar, 4 passport photos, TC, character certificate.' },
      { q: 'What is the all-inclusive hostel fee?', a: '₹85,000 per year — room, mess (veg + non-veg), laundry, Wi-Fi, RO water, and 24/7 backup.' },
      { q: 'What about weekend visits?', a: 'Yes — many Delhi students travel home for long weekends and breaks. Volvos run 24/7.' },
      { q: 'Is non-veg food available?', a: 'Yes — North Indian veg + non-veg menu, rotated weekly. Festival specials.' },
      { q: 'Will language be a barrier?', a: 'No — classes in English with Hindi support. Almost everyone you meet speaks Hindi.' },
      { q: 'When is the last date to apply?', a: 'Counselling starts after the 12th results. Hostel seats are first-come-first-served — reserve early.' },
    ],
    ogTitle: 'B.Sc Nursing for Delhi Students | Clean Air + 40% Lower Fees',
    ogDescription: 'Escape NCR pollution. INC approved nursing college with secure hostel. 30–40% lower fees than Delhi.',
  },
};
