import {
	Association, DataTypes, HasManyAddAssociationMixin, HasManyCountAssociationsMixin,
	HasManyCreateAssociationMixin, HasManyGetAssociationsMixin, HasManyHasAssociationMixin,
	HasManySetAssociationsMixin, HasManyAddAssociationsMixin, HasManyHasAssociationsMixin,
	HasManyRemoveAssociationMixin, HasManyRemoveAssociationsMixin, Model, ModelDefined, Optional,
	Sequelize, InferAttributes, InferCreationAttributes, CreationOptional, NonAttribute, ForeignKey, WhereOptions, Op,
} from 'sequelize';
import { promises as fs } from 'fs';

const dbfile = './db/db.sqlite';
const itemImport = './db/Zutaten_final.csv';
const recipeImport = './db/Tranke_zwischenstand.csv';

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
	if (itemData.length < 4) return;
	if (!itemData[1] && !itemData[1] && !itemData[2] && !itemData[3]) return;

	const name = itemData[0].trim();
	if (!name) return;

	const primaryQuery = itemData[1].trim();
	const secondaryQuery = itemData[2].trim();
	const tags = toObjectArray(itemData[3]);

	const recipe = await Recipe.create({
		name,
		originalQueryPrimary: primaryQuery,
		originalQuerySecondary: secondaryQuery,
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


	// const res = await getResultSpaceForBaseQuery(query);
	const res = await createActualRecipe({
		base: 47,
		randomStrength: 0.25,
		regions: [0, 1, 2, 3],
		randomRange: {
			min: 0,
			max: 3,
		},
	});
	// const parsed = parseQuery('');
	// console.log(parsed)
	// const res = await getResultSpaceForQuery(parsed, [0,1,3,]);
	// const test = await getItemResultSpace();
	console.log(res)
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

async function getItemsForQuery(query: string, createRecipeOptions: CreateRecipeOptions, preferred: number[] = []): Promise<Item[]> {
	const result: Item[] = [];
	if (!query) return result;
	const queryParts = query.split(';').map(q => q.trim());
	for (const part of queryParts) {
		if (!part) continue;
		result.push(await getItemForQuery(part, createRecipeOptions, preferred));
	}
	return result;
}

async function getItemForQuery(query: string, createRecipeOptions: CreateRecipeOptions, preferred: number[] = []) {
	const resultSpace = await getResultSpaceForBaseQuery(query, createRecipeOptions.regions);
	if (!resultSpace.length) {
		throw new Error(`empty result space for query ${query}, regions: ${createRecipeOptions.regions}`);
	}
	const weights = resultSpace.map(item => {
		let weight = 1000;

		let sumPreferredFactor = 1;

		if (item.Tags){
			for (const tag of item.Tags) {
				if (preferred.indexOf(tag.id) > -1) sumPreferredFactor = sumPreferredFactor + preferredFactor;
				if (tag.name === preciousName) weight = weight * preciousFactor;
			}
		}

		weight = weight * sumPreferredFactor;

		weight = weight * item.availability;

		if (createRecipeOptions.qualityWeights?.useWeights){
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
			return resultSpace[index];
		}
	}
}

function getWeightByPotency(potency: number, mean: number, nDeviate: number){
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

async function getResultSpaceForBaseQuery(query: string, regions: number[] = []): Promise<Item[]> {
	const parsedQuery = parseQuery(query);
	const resultIds = await getResultSpaceForQuery(parsedQuery, regions);
	return Item.findAll({
		where: {
			id: resultIds
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
	potency: number;
	adjustedPotency: number;
	class: string;
	adjustedClass: string;
}

async function createActualRecipe(createRecipeOptions: CreateRecipeOptions) {
	const recipe = await Recipe.findOne({ where: { id: createRecipeOptions.base }, include: [Tag] });
	const preferred = recipe.Tags.map(t => t.id);

	const primary = await getItemsForQuery(recipe.originalQueryPrimary, createRecipeOptions, preferred);
	const secondary = await getItemsForQuery(recipe.originalQuerySecondary, createRecipeOptions, preferred);
	await addRandomIngs(secondary, createRecipeOptions, preferred);

	const primaryPotency = getPrimaryPotency(primary);
	const secondaryPotency = getSecondaryPotency(secondary);

	const potency = primaryPotency * secondaryPotency;

	let adjustedPotency = potency;

	if (createRecipeOptions.randomStrength > 0) {
		const mod = getBiasedMod(primary.length + secondary.length, createRecipeOptions.randomStrength);
		if (mod > 0) adjustedPotency = adjustedPotency * (1 + mod);
		else adjustedPotency = adjustedPotency / (1 - mod);
	}

	return toSimpleRecipe(recipe.name, primary.map(i => i.name), secondary.map(i => i.name), potency, adjustedPotency)
}

async function addRandomIngs(secondary: Item[], createRecipeOptions: CreateRecipeOptions, preferred: number[] = []) {
	const max = createRecipeOptions.randomRange?.max || 3;
	const min = createRecipeOptions.randomRange?.min || 0;
	const count = Math.floor(Math.random() * (max - min + 1));
	let i = 0;
	while (i < count) {
		const item = await getItemForQuery('', createRecipeOptions, preferred);
		secondary.push(item);
		i++
	}
}

function getPrimaryPotency(primary: Item[]) {
	let potency = 0;
	let factor = 1;
	for (const item of primary) {
		potency = potency + factor * item.potency;
		factor = factor / 2;
	}
	return potency;
}

function getSecondaryPotency(secondary: Item[]) {
	let potency = 0;
	for (const item of secondary) {
		potency = potency + item.potency;
	}
	potency = secondary.length ? potency / secondary.length : 0;
	potency = potency + 1;
	potency = Math.sqrt(potency);
	return potency;
}

function getBiasedMod(count: number, randomStrength: number) {
	let exp = 1;

	if (count > 4) {
		exp = 0.85 ** (count - 4)
	}
	const val = 2 * randomStrength * (Math.random() ** exp) - randomStrength;

	return val;
}

function toSimpleRecipe(name: string, primary: string[], secondary: string[], potency: number, adjustedPotency: number): SimpleAlchemyRecipe {
	return {
		name,
		primary,
		secondary,
		potency,
		adjustedPotency,
		class: potToQual(potency),
		adjustedClass: potToQual(adjustedPotency),
	};
}

const levels = ['A', 'B', 'C', 'D', 'E', 'F'];
function potToQual(potency: number) {
	if (potency >= 12) return 'F';
	return levels[Math.floor(potency / 2.4)]
}

export async function getRecipes(){
	return (await Recipe.findAll()).map(({id, name}) => {
		return {
			id, name
		};
	});
}

export async function getRegions(){
	return (await Region.findAll()).map(({id, name}) => {
		return {
			id, name
		};
	});
}

export async function createRecipe(data){
	try{
		console.log('createRecipe', data)
		const result = await createActualRecipe(data);
		console.log(result);
		return result;
	}catch(e){
		console.log(e)
		return ''+e;
	}
}