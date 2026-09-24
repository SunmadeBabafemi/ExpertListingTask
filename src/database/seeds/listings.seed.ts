import { Listing } from '../../listings/entities/listing.entity.js';
import { ListingType } from '../../listings/listing-type.enum.js';
import AppDataSource from '../ormconfig.js';

const AGENTS = [
  '6f1c1d9e-2b8a-4d7e-9a57-0e3f2c1b4a10',
  'b3a0e7c2-5d14-4f6a-8c1e-2f9d7a6b5c40',
  'e8d2f1a4-7c3b-4e9d-a6f5-1b2c3d4e5f60',
];

const SAMPLES: {
  title: string;
  price: number;
  type: ListingType;
  bedrooms: number;
  lat: number;
  lng: number;
  address: string;
}[] = [
  {
    title: '3 bedroom flat with BQ',
    price: 4_500_000,
    type: ListingType.Rent,
    bedrooms: 3,
    lat: 6.4474,
    lng: 3.47,
    address: 'Lekki Phase 1, Lagos',
  },
  {
    title: 'Luxury 4 bedroom terrace',
    price: 180_000_000,
    type: ListingType.Sale,
    bedrooms: 4,
    lat: 6.4412,
    lng: 3.5312,
    address: 'Chevron Drive, Lekki, Lagos',
  },
  {
    title: 'Serviced studio near Admiralty Way',
    price: 65_000,
    type: ListingType.Shortlet,
    bedrooms: 1,
    lat: 6.4298,
    lng: 3.4513,
    address: 'Admiralty Way, Lekki, Lagos',
  },
  {
    title: '2 bedroom apartment, Victoria Island',
    price: 7_000_000,
    type: ListingType.Rent,
    bedrooms: 2,
    lat: 6.4281,
    lng: 3.4219,
    address: 'Adeola Odeku St, VI, Lagos',
  },
  {
    title: 'Ocean view penthouse',
    price: 950_000_000,
    type: ListingType.Sale,
    bedrooms: 5,
    lat: 6.4245,
    lng: 3.4061,
    address: 'Eko Atlantic, Lagos',
  },
  {
    title: 'Cosy 1 bedroom, Ikoyi',
    price: 90_000,
    type: ListingType.Shortlet,
    bedrooms: 1,
    lat: 6.4549,
    lng: 3.4346,
    address: 'Bourdillon Rd, Ikoyi, Lagos',
  },
  {
    title: 'Mini flat in Yaba',
    price: 1_200_000,
    type: ListingType.Rent,
    bedrooms: 1,
    lat: 6.5095,
    lng: 3.3711,
    address: 'Herbert Macaulay Way, Yaba, Lagos',
  },
  {
    title: '4 bedroom duplex, GRA Ikeja',
    price: 250_000_000,
    type: ListingType.Sale,
    bedrooms: 4,
    lat: 6.5779,
    lng: 3.3515,
    address: 'Isaac John St, Ikeja GRA, Lagos',
  },
  {
    title: '3 bedroom flat, Surulere',
    price: 2_800_000,
    type: ListingType.Rent,
    bedrooms: 3,
    lat: 6.4969,
    lng: 3.3481,
    address: 'Adeniran Ogunsanya, Surulere, Lagos',
  },
  {
    title: 'Self-contained room, Ajah',
    price: 450_000,
    type: ListingType.Rent,
    bedrooms: 0,
    lat: 6.4698,
    lng: 3.5852,
    address: 'Ajah, Lagos',
  },
  {
    title: '5 bedroom detached house, Maitama',
    price: 600_000_000,
    type: ListingType.Sale,
    bedrooms: 5,
    lat: 9.0833,
    lng: 7.4966,
    address: 'Maitama, Abuja',
  },
  {
    title: '2 bedroom serviced flat, Wuse 2',
    price: 120_000,
    type: ListingType.Shortlet,
    bedrooms: 2,
    lat: 9.0765,
    lng: 7.4786,
    address: 'Wuse 2, Abuja',
  },
];

async function seed() {
  await AppDataSource.initialize();
  try {
    const repo = AppDataSource.getRepository(Listing);
    const existing = await repo.count();
    if (existing > 0) {
      console.log(`listings already has ${existing} rows, skipping seed`);
      return;
    }

    const rows = SAMPLES.map(({ lat, lng, ...fields }, i) =>
      repo.create({
        ...fields,
        location: { type: 'Point', coordinates: [lng, lat] },
        agentId: AGENTS[i % AGENTS.length],
      }),
    );
    await repo.save(rows);
    console.log(`Seeded ${rows.length} listings`);
  } finally {
    await AppDataSource.destroy();
  }
}

await seed();
