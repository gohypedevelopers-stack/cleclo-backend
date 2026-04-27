const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🌱 UPSERTING Catalog Service database with financial test cases...');

    // 1. Categories
    const catMen = await prisma.category.upsert({ where: { name: 'Men' }, update: {}, create: { name: 'Men', description: "Men's Clothing", iconUrl: 'men.png', isActive: true }});
    const catWomen = await prisma.category.upsert({ where: { name: 'Women' }, update: {}, create: { name: 'Women', description: "Women's Clothing", iconUrl: 'women.png', isActive: true }});
    const catHome = await prisma.category.upsert({ where: { name: 'Home' }, update: {}, create: { name: 'Home', description: "Home Furnishings", iconUrl: 'home.png', isActive: true }});

    // 2. SubCategories
    const subShirts = await prisma.subCategory.upsert({ where: { name: 'Shirts & T-Shirts' }, update: {}, create: { categoryId: catMen.id, name: 'Shirts & T-Shirts', isActive: true }});
    const subEthnic = await prisma.subCategory.upsert({ where: { name: 'Ethnic Wear' }, update: {}, create: { categoryId: catWomen.id, name: 'Ethnic Wear', isActive: true }});
    const subBed = await prisma.subCategory.upsert({ where: { name: 'Bed & Bath' }, update: {}, create: { categoryId: catHome.id, name: 'Bed & Bath', isActive: true }});

    // 3. Service Items (With intentional margin variations including a LOSS case)
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
        // Find existing to avoid dupes since we don't have unique on name
        const existing = await prisma.serviceItem.findFirst({ where: { name: item.name } });
        if (existing) {
            await prisma.serviceItem.update({
                where: { id: existing.id },
                data: { customerPrice: item.cp, vendorShare: item.vs, isActive: true }
            });
        } else {
            await prisma.serviceItem.create({
                data: {
                    subCategoryId: item.subCat,
                    name: item.name,
                    description: `Standard ${item.name}`,
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
