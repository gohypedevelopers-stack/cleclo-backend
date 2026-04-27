const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🌱 UPSERTING Catalog Service database with financial test cases...');

    // 1. Service
    let mainService = await prisma.service.findFirst({ where: { name: 'Laundry' } });
    if (!mainService) {
        mainService = await prisma.service.create({ data: { name: 'Laundry', slug: 'laundry', isActive: true } });
    }

    // 2. Categories
    const upsertCat = async (name) => {
        let cat = await prisma.category.findFirst({ where: { name } });
        if (!cat) cat = await prisma.category.create({ data: { name, serviceId: mainService.id, isActive: true } });
        return cat;
    };
    const catMen = await upsertCat('Men');
    const catWomen = await upsertCat('Women');
    const catHome = await upsertCat('Home');

    // 3. SubCategories
    const upsertSubCat = async (name, catId) => {
        let sub = await prisma.subCategory.findFirst({ where: { name } });
        if (!sub) sub = await prisma.subCategory.create({ data: { name, categoryId: catId, isActive: true } });
        return sub;
    };
    const subShirts = await upsertSubCat('Shirts & T-Shirts', catMen.id);
    const subEthnic = await upsertSubCat('Ethnic Wear', catWomen.id);
    const subBed = await upsertSubCat('Bed & Bath', catHome.id);

    // 4. Service Items (With intentional margin variations including a LOSS case)
    const items = [
        { name: 'Cotton Shirt - Wash & Iron', subCat: subShirts.id, cp: 60, vs: 45 },  // 25% margin
        { name: 'T-Shirt - Dry Clean', subCat: subShirts.id, cp: 120, vs: 80 },        // 33% margin
        { name: 'Silk Saree - Premium Clean', subCat: subEthnic.id, cp: 450, vs: 300 },// 33% margin
        { name: 'Lehenga - Heavy Work', subCat: subEthnic.id, cp: 1200, vs: 1200 },    // 0% margin (Loss after GST)
        { name: 'Designer Blouse', subCat: subEthnic.id, cp: 250, vs: 280 },           // Negative margin! (Direct loss)
        { name: 'Bedsheet - Double', subCat: subBed.id, cp: 150, vs: 100 },            // 33% margin
        { name: 'Comforter/Blanket', subCat: subBed.id, cp: 350, vs: 250 },            // 28% margin
    ];

    for (const item of items) {
        const existing = await prisma.item.findFirst({ where: { name: item.name } });
        if (existing) {
            await prisma.item.update({
                where: { id: existing.id },
                data: { customerPrice: item.cp, vendorShare: item.vs, isActive: true }
            });
        } else {
            await prisma.item.create({
                data: {
                    subCategoryId: item.subCat,
                    name: item.name,
                    customerPrice: item.cp,
                    vendorShare: item.vs,
                    isActive: true
                }
            });
        }
    }

    console.log('✅ Catalog Items upserted with Margin test cases!');
}
main().catch(console.error).finally(() => prisma.$disconnect());
