import { TagRepository } from '@db/repositories/tag.repository';
import { Service } from 'typedi';
import { validateEntity } from '@/GenericHelpers';
import type { ITagWithCountDb } from '@/Interfaces';
import type { TagEntity } from '@db/entities/TagEntity';
import { ExternalHooks } from '@/ExternalHooks';

type GetAllResult<T> = T extends { withUsageCount: true } ? ITagWithCountDb[] : TagEntity[];

@Service()
export class TagService {
	constructor(
		private externalHooks: ExternalHooks,
		private tagRepository: TagRepository,
	) {}

	toEntity(attrs: { name: string; id?: string }) {
		// Handle undefined/null name to prevent trim() errors
		if (!attrs.name || typeof attrs.name !== 'string') {
			// Use a default valid tag name instead of empty string
			attrs.name = 'imported';
		} else {
			attrs.name = attrs.name.trim();
			// Ensure the name meets length requirements (1-24 characters)
			if (attrs.name.length === 0) {
				attrs.name = 'imported';
			} else if (attrs.name.length > 24) {
				attrs.name = attrs.name.substring(0, 24);
			}
		}

		return this.tagRepository.create(attrs);
	}

	async save(tag: TagEntity, actionKind: 'create' | 'update') {
		await validateEntity(tag);

		const action = actionKind[0].toUpperCase() + actionKind.slice(1);

		await this.externalHooks.run(`tag.before${action}`, [tag]);

		const savedTag = this.tagRepository.save(tag, { transaction: false });

		await this.externalHooks.run(`tag.after${action}`, [tag]);

		return await savedTag;
	}

	async delete(id: string) {
		await this.externalHooks.run('tag.beforeDelete', [id]);

		const deleteResult = this.tagRepository.delete(id);

		await this.externalHooks.run('tag.afterDelete', [id]);

		return await deleteResult;
	}

	async getAll<T extends { withUsageCount: boolean }>(options?: T): Promise<GetAllResult<T>> {
		if (options?.withUsageCount) {
			const allTags = await this.tagRepository.find({
				select: ['id', 'name', 'createdAt', 'updatedAt'],
				relations: ['workflowMappings'],
			});

			return allTags.map(({ workflowMappings, ...rest }) => {
				return {
					...rest,
					usageCount: workflowMappings.length,
				} as ITagWithCountDb;
			}) as GetAllResult<T>;
		}

		return await (this.tagRepository.find({
			select: ['id', 'name', 'createdAt', 'updatedAt'],
		}) as Promise<GetAllResult<T>>);
	}

	async getById(id: string) {
		return await this.tagRepository.findOneOrFail({
			where: { id },
		});
	}

	/**
	 * Sort tags based on the order of the tag IDs in the request.
	 */
	sortByRequestOrder(tags: TagEntity[], { requestOrder }: { requestOrder: string[] }) {
		const tagMap = tags.reduce<Record<string, TagEntity>>((acc, tag) => {
			acc[tag.id] = tag;
			return acc;
		}, {});

		return requestOrder.map((tagId) => tagMap[tagId]);
	}
}
