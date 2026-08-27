import type { Deal, Booking, Talent } from '@/lib/data/deals';

/**
 * Documents you can look at before any real one exists.
 *
 * The same idea as the teardown's `sample`: a page that is always reachable,
 * never touches the store, and cannot be mistaken for a real one — every
 * surface that renders these stamps them as a specimen.
 */
export const SAMPLE_DEAL: Deal = {
  id: 'sample',
  clientName: 'Bayt Al-Akhdar',
  contactName: 'Nadia H.',
  clientHandle: 'baytalakhdar',
  concepts: [
    { conceptN: 1, name: 'The Inbox Twelve', priceJOD: 1500 },
    { conceptN: 8, name: 'The Menu Day', priceJOD: 1200 },
  ],
  clientTotalJOD: 2700,
  perMonth: 6,
  // six videos at 150 plus the 400 retainer
  retainerJOD: 1300,
  selection: { concepts: [0, 2], perMonth: 6, ads: true },
  source: 'configurator',
  status: 'proposed',
  createdAt: '2026-08-27T09:00:00.000Z',
  updatedAt: '2026-08-27T09:00:00.000Z',
};

export const SAMPLE_TALENT: Talent = {
  id: 'sample',
  name: { ar: 'رنا', en: 'Rana' },
  discipline: 'videographer',
  dayRateJOD: 35,
  phone: '',
  availability: 'available',
  active: true,
  placeholder: true,
  createdAt: '2026-08-01T00:00:00.000Z',
};

const day = (n: number, fee: number, brief: string, status: Booking['status']): Booking => ({
  id: `sample-${n}`, dealId: 'sample', talentId: 'sample',
  date: `2026-08-${String(n).padStart(2, '0')}`,
  feeJOD: fee, status, brief,
  createdAt: '2026-08-01T00:00:00.000Z',
});

export const SAMPLE_BOOKINGS: Booking[] = [
  day(6, 35, 'يوم تصوير · بيت الأخضر', 'paid'),
  day(13, 35, 'يوم تصوير · نادي ستّين', 'done'),
  day(21, 35, 'إعادة تصوير · بصريات الزيتونة', 'done'),
];
