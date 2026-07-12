import Role from '../models/Role.js';

async function seedRoles() {
  const roles = ['admin', 'candidate', 'recruiter'];
  const count = await Role.countDocuments();
  if (count === 0) {
    await Role.insertMany(roles.map((name) => ({ name })));
    console.log('Seeded default roles');
  }
}

export { seedRoles };
