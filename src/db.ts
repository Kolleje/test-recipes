import {
	Association, DataTypes, HasManyAddAssociationMixin, HasManyCountAssociationsMixin,
	HasManyCreateAssociationMixin, HasManyGetAssociationsMixin, HasManyHasAssociationMixin,
	HasManySetAssociationsMixin, HasManyAddAssociationsMixin, HasManyHasAssociationsMixin,
	HasManyRemoveAssociationMixin, HasManyRemoveAssociationsMixin, Model, ModelDefined, Optional,
	Sequelize, InferAttributes, InferCreationAttributes, CreationOptional, NonAttribute, ForeignKey, WhereOptions, Op,
} from 'sequelize';
import { promises as fs } from 'fs';

const dbfile = './db/db.sqlite';
const itemImport = './db/Zutaten_final_2.0.csv';
const recipeImport = './db/Tranke_final.csv';

const preferredFactor = 10;
const preciousName = 'wertvoll';
const preciousFactor = 0.1;

const queryCache: {
	[query: string]: Item[]
} = {};

// 'projects' is excluded as it's not an attribute, it's an association.
class Item extends Model<InferAttributes<Item, { omit: 'Tags' | 'Regions' }>, InferCreationAttributes<Item, { omit: 'Tags' | 'Regions' }>> {
	// class Item extends Model<InferAttributes<Item>, InferCreationAttributes<Item>> {
	// id can be undefined during creation when using `autoIncrement`
	declare id: CreationOptional<number>;
	declare name: string;

	declare availability: number;
	declare potency: number;
	declare amount: string;

	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;

	declare getTags: HasManyGetAssociationsMixin<Tag>; // Note the null assertions!
	declare addTag: HasManyAddAssociationMixin<Tag, number>;
	declare addRegion: HasManyAddAssociationMixin<Region, number>;
	// declare addProjects: HasManyAddAssociationsMixin<Tag, number>;
	// declare setProjects: HasManySetAssociationsMixin<Tag, number>;
	// declare removeProject: HasManyRemoveAssociationMixin<Tag, number>;
	// declare removeProjects: HasManyRemoveAssociationsMixin<Tag, number>;
	// declare hasProject: HasManyHasAssociationMixin<Tag, number>;
	// declare hasProjects: HasManyHasAssociationsMixin<Tag, number>;
	// declare countProjects: HasManyCountAssociationsMixin;
	// declare createProject: HasManyCreateAssociationMixin<Tag, 'ownerId'>;

	// You can also pre-declare possible inclusions, these will only be populated if you
	// actively include a relation.
	declare Tags?: NonAttribute<Tag[]>; // Note this is optional since it's only populated when explicitly requested in code
	declare Regions?: NonAttribute<Region[]>;

	// getters that are not attributes should be tagged using NonAttribute
	// to remove them from the model's Attribute Typings.
	get fullName(): NonAttribute<string> {
		return this.name;
	}

	declare static associations: {
		Tags: Association<Item, Tag>;
		Regions: Association<Item, Region>;
	};

	contribution?: number;
}

class Tag extends Model<
	InferAttributes<Tag, { omit: 'Items' }>,
	InferCreationAttributes<Tag, { omit: 'Items' }>
> {
	declare id: CreationOptional<number>;
	declare name: string;

	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;

	declare Items?: NonAttribute<Item[]>;

	declare static associations: {
		Items: Association<Tag, Item>;
	};
}

class Region extends Model<
	InferAttributes<Region, { omit: 'Items' }>,
	InferCreationAttributes<Region, { omit: 'Items' }>
> {
	declare id: CreationOptional<number>;
	declare name: string;

	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;

	declare Items?: NonAttribute<Item[]>;

	declare static associations: {
		Items: Association<Region, Item>;
	};
}

class Recipe extends Model<
	InferAttributes<Recipe>,
	InferCreationAttributes<Recipe>
> {
	declare id: CreationOptional<number>;
	declare name: string;
	declare originalQueryPrimary: string;
	declare originalQuerySecondary: string;
	// declare originalQueryTertiary: string;
	declare complexity: number;

	declare createdAt: CreationOptional<Date>;
	declare updatedAt: CreationOptional<Date>;

	declare getTags: HasManyGetAssociationsMixin<Tag>;
	declare addTag: HasManyAddAssociationMixin<Tag, number>;

	declare Tags?: NonAttribute<Tag[]>;

	declare static associations: {
		Tags: Association<Recipe, Tag>;
	};
}

async function initdb(dbfile: string) {
	const sequelize = new Sequelize({
		dialect: 'sqlite',
		storage: dbfile,
		logging: false,
	});

	Tag.init(
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true
			},
			name: {
				type: new DataTypes.STRING(255),
				allowNull: false,
				unique: true,
			},
			createdAt: DataTypes.DATE,
			updatedAt: DataTypes.DATE,
		},
		{
			sequelize,
			tableName: 'tags',
		}
	);

	Region.init(
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true
			},
			name: {
				type: new DataTypes.STRING(255),
				allowNull: false,
				unique: true,
			},
			createdAt: DataTypes.DATE,
			updatedAt: DataTypes.DATE,
		},
		{
			sequelize,
			tableName: 'regions',
		}
	);

	Item.init(
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true
			},
			name: {
				type: new DataTypes.STRING(255),
				allowNull: true
			},
			availability: {
				type: new DataTypes.INTEGER,
				allowNull: true
			},
			potency: {
				type: new DataTypes.INTEGER,
				allowNull: true
			},
			amount: {
				type: new DataTypes.STRING(255),
				allowNull: true
			},
			createdAt: DataTypes.DATE,
			updatedAt: DataTypes.DATE,
		},
		{
			tableName: 'items',
			sequelize,
		}
	);

	Recipe.init(
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true
			},
			name: {
				type: new DataTypes.STRING(255),
				allowNull: false,
				unique: true,
			},
			originalQueryPrimary: {
				type: new DataTypes.TEXT,
				allowNull: true,
			},
			originalQuerySecondary: {
				type: new DataTypes.TEXT,
				allowNull: true,
			},
			// originalQueryTertiary: {
			// 	type: new DataTypes.TEXT,
			// 	allowNull: true,
			// },
			complexity: {
				type: new DataTypes.INTEGER,
				allowNull: true,
			},
			createdAt: DataTypes.DATE,
			updatedAt: DataTypes.DATE,
		},
		{
			sequelize,
			tableName: 'recipes',
		}
	);

	Item.belongsToMany(Tag, { through: 'ItemTags' });
	Tag.belongsToMany(Item, { through: 'ItemTags' });

	Item.belongsToMany(Region, { through: 'ItemRegions' });
	Region.belongsToMany(Item, { through: 'ItemRegions' });

	Recipe.belongsToMany(Tag, { through: 'RecipeTags' });
	Tag.belongsToMany(Recipe, { through: 'RecipeTags' });

	return sequelize;
}

async function importRecipesFromFile(file: string) {
	const data = '' + await fs.readFile(file, { encoding: 'utf-8' });
	const lines = data.split('\n');

	//skip header
	for (let i = 1; i < lines.length; i++) {
		await addRecipeToDb(lines[i].split("'"));
	}
}

async function addRecipeToDb(itemData: string[]) {
	if (itemData.length < 5) return;
	if (!itemData[1] && !itemData[1] && !itemData[2] && !itemData[3] && !itemData[4]) return;

	const name = itemData[0].trim();
	if (!name) return;

	const primaryQuery = itemData[1].trim();
	const secondaryQuery = itemData[2].trim();
	// const tertiaryQuery = itemData[3].trim();
	const tags = toObjectArray(itemData[3]);
	const complexity = parseInt(itemData[4].trim());

	const recipe = await Recipe.create({
		name,
		originalQueryPrimary: primaryQuery,
		originalQuerySecondary: secondaryQuery,
		// originalQueryTertiary: tertiaryQuery,
		complexity,
	});

	for (const tag of tags) {
		await recipe.addTag((await Tag.findOrCreate({
			where: tag,
			defaults: tag,
		}))[0]);
	}
}

async function importItemsFromFile(file: string) {
	const data = '' + await fs.readFile(file, { encoding: 'utf-8' });
	const lines = data.split('\n');

	//skip header
	for (let i = 1; i < lines.length; i++) {
		await addItemToDb(lines[i].split("'"));
	}
}


async function addItemToDb(itemData: string[]) {
	if (itemData.length < 7) return;
	const name = itemData[0].trim();
	const availability = parseInt(itemData[2]);
	const potency = parseInt(itemData[3]);
	const amount = itemData[5].trim();

	const regions = toObjectArray(itemData[4]);
	const categories = toObjectArray(itemData[1]);
	const tags = categories.concat(toObjectArray(itemData[6]));

	const item = await Item.create({
		name,
		availability,
		potency,
		amount,
	}, {
		include: [Tag]
	});

	for (const tag of tags) {
		await item.addTag((await Tag.findOrCreate({
			where: tag,
			defaults: tag,
		}))[0]);
	}

	for (const region of regions) {
		await item.addRegion((await Region.findOrCreate({
			where: region,
			defaults: region,
		}))[0]);
	}
}

function toObjectArray(itemData: string): { name: string }[] {
	const cleanedArray = itemData.split(';').map(r => r.trim()).filter(r => !!r);
	return cleanedArray.map(name => ({ name }));
}

async function init(reset?: boolean) {
	try {
		if (reset) await fs.unlink(dbfile);
	} catch (e) { }

	const sequelize = await initdb(dbfile);

	if (reset) {
		await sequelize.sync();
		await importItemsFromFile(itemImport);
		await importRecipesFromFile(recipeImport);
	}

	const itemCount = await Item.count();
	const recipeCount = await Recipe.count();
	console.log(`init done`);
	console.log(`itemCount: ${itemCount}`);
	console.log(`recipeCount: ${recipeCount}`);

	const query = '!Heilpflanze & ?stärkend'
	//  !Heilpflanze; ?peraine; 

	// await testRecipes();

	// const res = await getResultSpaceForBaseQuery(query);
	// const res = await createActualRecipe({
	// 	base: 47,
	// 	randomStrength: 0.25,
	// 	regions: [0, 1, 2, 3],
	// 	randomRange: {
	// 		min: 0,
	// 		max: 3,
	// 	},
	// });
	// const parsed = parseQuery('');
	// console.log(parsed)
	// const res = await getResultSpaceForQuery(parsed, [0,1,3,]);
	// const test = await getItemResultSpace();
	// console.log(res)
}

async function testRecipes() {
	const recipes = await Recipe.findAll();
	const failed: { id: number, name: string }[] = [];
	for (const r of recipes) {
		try {
			const res = await createActualRecipe({
				base: r.id,
				randomStrength: 0.25,
				regions: [0, 1, 2, 3],
				randomRange: {
					min: 0,
					max: 3,
				},
			});
		} catch (e) {
			failed.push({
				id: r.id,
				name: r.name,
			});
			// console.log(r)
			// throw e
		}
	}
	console.log('failed: ' + failed.length);
	console.log(failed);
}

// export async function getItemResultSpace(tagQuery?: WhereOptions<InferAttributes<Tag>>, reqgionQuery?: WhereOptions<InferAttributes<Region>>) {
// 	// const results = await Item.findAll({
// 	// 	where: {
// 	// 		// [Op.and] : {
// 	// 		// 	'$Tags.name$': ['Heilpflanze','eigenschaftsmagisch']
// 	// 		// }
// 	// 	},
// 	// 	include: [{
// 	// 		model: Tag,
// 	// 		where: {
// 	// 			name: 'Heilpflanze'
// 	// 		},
// 	// 		required: true
// 	// 	},
// 	// 	{
// 	// 		model: Tag,
// 	// 		where: {
// 	// 			name: 'eigenschaftsmagisch'
// 	// 		},
// 	// 		required: true
// 	// 	},
// 	// 	{
// 	// 		model: Region,
// 	// 		where: reqgionQuery
// 	// 	}],
// 	// });

// 	return results;
// }

export async function getAllItems() {
	return Item.findAll();
}

async function getItemsForQuery(query: string, createRecipeOptions: CreateRecipeOptions, preferred: number[] = [], useExtraWeight?: boolean, minPotency?: number): Promise<Item[]> {
	const result: Item[] = [];
	if (!query) return result;
	const queryParts = query.split(';').map(q => q.trim());
	for (const part of queryParts) {
		if (!part) continue;
		result.push(await getItemForQuery(part, createRecipeOptions, preferred, useExtraWeight));
	}
	return result;
}

async function getItemForQuery(query: string, createRecipeOptions: CreateRecipeOptions, preferredTags: number[] = [], useExtraWeight?: boolean, minPotency?: number) {
	const resultSpace = await getResultSpaceForBaseQuery(query, createRecipeOptions.regions, minPotency);
	if (!resultSpace.length) {
		throw new Error(`empty result space for query ${query}, regions: ${createRecipeOptions.regions}`);
	}

	// console.log('getItemForQuery', {useExtraWeight, query, preferred: preferredTags})

	let localPreferred = preferredFactor;

	if (useExtraWeight) localPreferred = localPreferred * preferredFactor;
	const weights = resultSpace.map(item => {
		let weight = 1000;

		let sumPreferredFactor = 1;

		if (item.Tags) {
			// console.log('tags', item.Tags)
			for (const tag of item.Tags) {
				// if (preferred.indexOf(tag.id) > -1) sumPreferredFactor = sumPreferredFactor + preferredFactor;
				if (preferredTags.indexOf(tag.id) > -1) sumPreferredFactor = localPreferred;
				if (tag.name === preciousName) weight = weight * preciousFactor;
			}
		}

		weight = weight * sumPreferredFactor;

		weight = weight * item.availability;

		if (createRecipeOptions.qualityWeights?.useWeights) {
			weight = weight * getWeightByPotency(item.potency, createRecipeOptions.qualityWeights.mean, createRecipeOptions.qualityWeights.nDeviate);
		}

		return weight;
	});

	const totalWeight = weights.reduce((acc, current = 0) => acc + current);

	const roll = Math.random() * totalWeight;


	let currentWeight = 0;
	for (const index in weights) {
		currentWeight = currentWeight + weights[index];
		if (roll < currentWeight) {
			// console.log({ roll, totalWeight, index, size: resultSpace.length })
			// console.log('item tags:' +  resultSpace[index].Tags.map(t=>t.id));
			return resultSpace[index];
		}
	}
}

function getWeightByPotency(potency: number, mean: number, nDeviate: number) {
	return Math.E ** (-0.5 * ((potency - mean) / nDeviate) ** 2);
}

type ParsedQuery = {
	q?: string;
	and?: ParsedQuery[];
	or?: ParsedQuery[];
}

function parseQuery(query: string) {
	const result: ParsedQuery = {}
	const ands = query.split('&').map(q => q.trim());
	if (ands.length > 1) {
		result.and = []
		for (const and of ands) {
			result.and.push(parseQuery(and))
		}
		return result;
	}

	const ors = query.split('|').map(q => q.trim());
	if (ors.length > 1) {
		result.or = []
		for (const or of ors) {
			result.or.push(parseQuery(or))
		}
		return result;
	}

	result.q = query.trim();

	return result;
}

async function getCompleteResultSpaceForQuery(query: string, createRecipeOptions: CreateRecipeOptions, minPotency: number = 0): Promise<number[]> {
	let result: number[] = [];
	if (!query) return result;
	const queryParts = query.split(';').map(q => q.trim());
	for (const part of queryParts) {
		if (!part) continue;
		const resultSpace = (await getResultSpaceForBaseQuery(part, createRecipeOptions.regions, minPotency)).map(item => item.id);
		result = result.concat(resultSpace);
	}
	return result;

}

async function getResultSpaceForBaseQuery(query: string, regions: number[] = [], minPotency: number = 0): Promise<Item[]> {
	const parsedQuery = parseQuery(query);
	const resultIds = await getResultSpaceForQuery(parsedQuery, regions);
	return Item.findAll({
		where: {
			id: resultIds,
			potency: {
				[Op.gte]: minPotency
			}
		},
		include: [Tag, Region]
	});
}

async function getResultSpaceForQuery(query: ParsedQuery, regions: number[] = []): Promise<number[]> {
	if (query.q != null) return resolveSingle(query.q, regions);
	if (query.and) return resolveAnd(query.and, regions);
	if (query.or) return resolveOr(query.or, regions);
	return [];
}

async function resolveSingle(q: string, regions: number[] = []): Promise<number[]> {
	if (!q) return (await Item.findAll()).map(item => item.id);
	const type = q[0];
	if (type === '!' || type === '?') {
		const name = q.slice(1);
		return (await Item.findAll({
			include: [{
				model: Tag,
				where: {
					name
				}
			}, {
				model: Region,
				where: {
					id: regions
				},
			}],
		})).map(item => item.id);
	}

	return (await Item.findAll({
		where: {
			name: q
		},
		include: [{
			model: Tag
		}, {
			model: Region,
			where: {
				id: regions
			},
		}],
	})).map(item => item.id);
}

async function resolveAnd(and: ParsedQuery[], regions: number[] = []): Promise<number[]> {
	const resultsP = and.map(x => getResultSpaceForQuery(x, regions));
	const results = await Promise.all(resultsP);
	let result = results[0];
	let i = 1;
	while (i < results.length) {
		result = andResults(result, results[i]);
		i++;
	}
	return result;
}

// async function resolveOr(or: ParsedQuery[], regionQuery: WhereOptions<InferAttributes<Region>> = {}): Promise<number[]> {
async function resolveOr(or: ParsedQuery[], regions: number[] = []): Promise<number[]> {
	const resultsP = or.map(x => getResultSpaceForQuery(x, regions));
	const results = await Promise.all(resultsP);
	let result = results[0];
	let i = 1;
	while (i < results.length) {
		result = orResults(result, results[i]);
		i++;
	}
	return result;
}

function orResults(a: number[], b: number[]): number[] {
	const res = a.slice();
	for (const x of b) {
		if (a.indexOf(x) === -1) res.push(x);
	}
	return res;
}

function andResults(a: number[], b: number[]): number[] {
	const res = [];
	for (const x of a) {
		if (b.indexOf(x) >= 0) res.push(x);
	}
	return res;
}

init(false);

type CreateRecipeOptions = {
	base: number;
	randomStrength?: number;
	regions?: number[];
	randomRange?: {
		min: number,
		max: number,
	};
	qualityWeights?: {
		useWeights: boolean;
		mean: number;
		nDeviate: number;
	}
}

type SimpleAlchemyRecipe = {
	name: string;
	primary: string[];
	secondary: string[];
	complexity: number;
	complexityAdjustment: number;
	additionalVoluntary: string[];
	additionalForced: string[];
	orderedItems: {
		name: string;
		contribution: number;
		potency: number;
	}[];
	potency: number;
	adjustedPotency: number;
	class: string;
	adjustedClass: string;
	adjustedSecondary: number;
	duration: number;
	// recipe: string;
}

async function createActualRecipe(createRecipeOptions: CreateRecipeOptions) {
	const recipe = await Recipe.findOne({ where: { id: createRecipeOptions.base }, include: [Tag] });
	const preferredTags = recipe.Tags.map(t => t.id);

	const primary = await getItemsForQuery(recipe.originalQueryPrimary, createRecipeOptions, []);
	const secondary = await getItemsForQuery(recipe.originalQuerySecondary, createRecipeOptions, preferredTags);

	const additionalVoluntary: Item[] = [];

	const primaryPotency = getPrimaryPotency(primary);

	await addRandomIngs(additionalVoluntary, createRecipeOptions, preferredTags);

	const additionalForced: Item[] = [];
	await addRandomIngsForced(additionalForced, createRecipeOptions, [], primaryPotency);

	const resultSpace = await getCompleteResultSpaceForQuery(recipe.originalQuerySecondary, createRecipeOptions);

	const combinedSecondary = secondary.concat(additionalVoluntary).concat(additionalForced);

	const secondaryPotency = getSecondaryPotency(combinedSecondary, preferredTags, resultSpace);

	const adjustedPotency = getAdjustedPotency(primaryPotency, primary.length + secondary.length, createRecipeOptions.randomStrength);
	const adjustedSecondary = getAdjustedPotency(secondaryPotency, secondary.length, createRecipeOptions.randomStrength);

	return toSimpleRecipe(recipe, primary.map(i => i.name), secondary.map(i => i.name), additionalVoluntary.map(i => i.name), additionalForced.map(i => i.name), combinedSecondary, primaryPotency, adjustedPotency, secondaryPotency, adjustedSecondary)
}

function getAdjustedPotency(potency: number, count: number, randomStrength: number) {
	if (randomStrength > 0) {
		const mod = getBiasedMod(count, randomStrength);
		if (mod > 0) potency = potency * (1 + mod);
		else potency = potency / (1 - mod);
	}
	return potency;
}

async function addRandomIngs(secondary: Item[], createRecipeOptions: CreateRecipeOptions, preferredTags: number[] = []) {
	const max = createRecipeOptions.randomRange?.max || 3;
	const min = createRecipeOptions.randomRange?.min || 0;
	const count = Math.floor(Math.random() * (max - min + 1));
	let i = 0;
	while (i < count) {
		const item = await getItemForQuery('', createRecipeOptions, preferredTags, true, 1);
		secondary.push(item);
		i++
	}
}

async function addRandomIngsForced(secondary: Item[], createRecipeOptions: CreateRecipeOptions, preferred: number[] = [], primaryPotency: number) {
	let t = 1;
	let count = 0;
	while (t <= primaryPotency) {
		t++;
		if (Math.random() < 1 / 3) count++;
	}
	// const max = createRecipeOptions.randomRange?.max || 3;
	// const min = createRecipeOptions.randomRange?.min || 0;
	// const count = Math.floor(Math.random() * (max - min + 1));
	let i = 0;
	while (i < count) {
		const item = await getItemForQuery('', createRecipeOptions, preferred, false, 0);
		secondary.push(item);
		i++
	}
}

// function getPrimaryPotency(primary: Item[]) {
// 	let potency = 0;
// 	let factor = 1;
// 	for (const item of primary) {
// 		potency = potency + factor * item.potency;
// 		factor = factor / 2;
// 	}
// 	return potency;
// }


function getPrimaryPotency(primary: Item[]) {
	let potency = 0;
	for (const item of primary) {
		potency += item.potency;
	}
	return potency / primary.length;
}

// function getSecondaryPotency(secondary: Item[]) {
// 	let potency = 0;
// 	for (const item of secondary) {
// 		potency = potency + item.potency;
// 	}
// 	potency = secondary.length ? potency / secondary.length : 0;
// 	potency = potency + 1;
// 	potency = Math.sqrt(potency);
// 	return potency;
// }

function getSecondaryPotency(secondary: Item[], preferredTags: number[], secondaryResultSpace: number[]) {

	secondary.sort((a, b) => {
		let bPotency = b.potency;
		if (secondaryResultSpace.includes(b.id) || ItemHasTagInList(b, preferredTags)) {
			bPotency = bPotency * 10;
		}

		let aPotency = a.potency;
		if (secondaryResultSpace.includes(a.id) || ItemHasTagInList(a, preferredTags)) {
			aPotency = aPotency * 10;
		}
		return bPotency - aPotency
	});

	let potency = 0;
	let fac = 1;
	for (const item of secondary) {
		if (secondaryResultSpace.includes(item.id) || ItemHasTagInList(item, preferredTags)) {
			const contribution = Math.round(item.potency * fac);
			potency = potency + contribution;
			item.contribution = contribution
			fac = fac / 2;
		} else {
			item.contribution = 0;
		}
	}

	return potency;
}

function ItemHasTagInList(item: Item, list: number[]) {
	if (!item?.Tags || !list) return false;
	for (const tag of item.Tags) {
		if (list.includes(tag.id)) return true;
	}
	return false;
}

function getBiasedMod(count: number, randomStrength: number) {
	let exp = 1;

	if (count > 4) {
		exp = 0.85 ** (count - 4)
	}
	const val = 2 * randomStrength * (Math.random() ** exp) - randomStrength;

	return val;
}

function toSimpleRecipe(recipe: Recipe, primary: string[], secondary: string[], additionalVoluntary: string[], additionalForced: string[], orderedItems: Item[], potency: number, adjustedPotency: number, secondaryPotency: number, adjustedSecondary: number): SimpleAlchemyRecipe {
	return {
		name: recipe.name,
		complexity: recipe.complexity,
		complexityAdjustment: secondaryPotency,
		primary,
		secondary,
		additionalVoluntary,
		additionalForced,
		orderedItems: orderedItems.map(item => {
			return {
				name: item.name,
				contribution: item.contribution,
				potency: item.potency,
			}
		}),
		potency,
		adjustedPotency,
		adjustedSecondary,
		class: potToQual(potency),
		adjustedClass: potToQual(adjustedPotency),
		duration: getDuration(),
	};
}

const levels = ['A', 'B', 'C', 'D', 'E', 'F'];
function potToQual(potency: number) {
	potency = potency - 1;
	if (potency >= 5) return 'F';
	if (potency < -0.5) return 'M';
	return levels[Math.round(potency)];
}

export async function getRecipes() {
	return (await Recipe.findAll()).map(({ id, name }) => {
		return {
			id, name
		};
	});
}

export async function getRegions() {
	return (await Region.findAll()).map(({ id, name }) => {
		return {
			id, name
		};
	});
}

export async function createRecipe(data) {
	try {
		const result = await createActualRecipe(data);
		// console.log(result);
		return result;
	} catch (e) {
		console.log(e)
		console.log('createRecipe', data)
		return '' + e;
	}
}

function getDuration() {
	const durations = {
		1: '1/4 ZE',
		2: '1/2 ZE',
		3: '1 ZE',
		4: '1 ZE',
		5: '1 ZE',
		6: '2 ZE',
		7: '2 ZE',
		8: '2 ZE',
		9: '3 ZE',
		10: '3 ZE',
		11: '4 ZE',
		12: 'eine Woche',
	}

	const numbers = [getRandomNForDuration(),getRandomNForDuration(),getRandomNForDuration()];
	numbers.sort();
	const result = Math.floor((numbers[1] + numbers[2]) / 2);
	return durations[result];
}

function getRandomNForDuration(){
	return Math.random()*12 + 1;
}
