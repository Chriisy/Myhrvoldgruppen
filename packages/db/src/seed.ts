import { db } from './client';
import { departments, users, suppliers, customers } from './schema';
import bcrypt from 'bcrypt';

async function seed() {
  console.log('Seeding database...');

  // Create departments
  const [oslo, bergen, trondheim] = await db.insert(departments).values([
    { name: 'Oslo', code: 'OSL', region: 'Østlandet' },
    { name: 'Bergen', code: 'BGO', region: 'Vestlandet' },
    { name: 'Trondheim', code: 'TRD', region: 'Trøndelag' },
  ]).returning();

  console.log('Created departments:', oslo.name, bergen.name, trondheim.name);

  // Create admin user
  const passwordHash = await bcrypt.hash('admin123', 12);
  const [admin] = await db.insert(users).values([
    {
      email: 'admin@myhrvold.no',
      password: passwordHash,
      firstName: 'Christopher',
      lastName: 'Strøm',
      role: 'admin',
      departmentId: oslo.id,
      isActive: true,
      emailVerified: true,
    },
  ]).returning();

  console.log('Created admin user:', admin.email);

  // Create suppliers
  const supplierData = [
    { name: 'UBERT', shortCode: 'UBE', warrantyMonths: 24 },
    { name: 'Electrolux Professional', shortCode: 'ELE', warrantyMonths: 24 },
    { name: 'Rational', shortCode: 'RAT', warrantyMonths: 36 },
    { name: 'Scotsman', shortCode: 'SCO', warrantyMonths: 24 },
    { name: 'Metos', shortCode: 'MET', warrantyMonths: 24 },
    { name: 'Hoshizaki', shortCode: 'HOS', warrantyMonths: 36 },
    { name: 'Gram', shortCode: 'GRA', warrantyMonths: 24 },
    { name: 'True', shortCode: 'TRU', warrantyMonths: 24 },
  ];

  await db.insert(suppliers).values(supplierData);
  console.log('Created suppliers:', supplierData.length);

  // Create sample customers
  const customerData = [
    { name: 'Kiwi Storgata', orgNumber: '999888777', city: 'Oslo' },
    { name: 'Meny Stavern', orgNumber: '999888776', city: 'Stavern' },
    { name: 'Thon Hotel Rosenkrantz', orgNumber: '999888775', city: 'Oslo' },
    { name: 'Coop Mega Sola', orgNumber: '999888774', city: 'Sola' },
  ];

  await db.insert(customers).values(customerData);
  console.log('Created customers:', customerData.length);

  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
