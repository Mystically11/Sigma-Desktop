// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import { pick } from 'lodash';

import type {
  ConversationStoryType,
  StoryViewType,
} from '../../components/StoryListItem';
import type { StateType } from '../reducer';
import type { StoriesStateType } from '../ducks/stories';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { getConversationSelector } from './conversations';

export const getStoriesState = (state: StateType): StoriesStateType =>
  state.stories;

export const shouldShowStoriesView = createSelector(
  getStoriesState,
  ({ isShowingStoriesView }): boolean => isShowingStoriesView
);

function getNewestStory(x: ConversationStoryType): StoryViewType {
  return x.stories[x.stories.length - 1];
}

function sortByRecencyAndUnread(
  a: ConversationStoryType,
  b: ConversationStoryType
): number {
  const storyA = getNewestStory(a);
  const storyB = getNewestStory(b);

  if (storyA.isUnread && storyB.isUnread) {
    return storyA.timestamp > storyB.timestamp ? -1 : 1;
  }

  if (storyB.isUnread) {
    return 1;
  }

  if (storyA.isUnread) {
    return -1;
  }

  return storyA.timestamp > storyB.timestamp ? -1 : 1;
}

export const getStories = createSelector(
  getConversationSelector,
  getStoriesState,
  shouldShowStoriesView,
  (
    conversationSelector,
    { stories }: Readonly<StoriesStateType>,
    isShowingStoriesView
  ): {
    hiddenStories: Array<ConversationStoryType>;
    stories: Array<ConversationStoryType>;
  } => {
    if (!isShowingStoriesView) {
      return {
        hiddenStories: [],
        stories: [],
      };
    }

    const storiesById = new Map<string, ConversationStoryType>();
    const hiddenStoriesById = new Map<string, ConversationStoryType>();

    stories.forEach(story => {
      const sender = pick(
        conversationSelector(story.sourceUuid || story.source),
        [
          'acceptedMessageRequest',
          'avatarPath',
          'color',
          'firstName',
          'hideStory',
          'id',
          'isMe',
          'name',
          'profileName',
          'sharedGroupNames',
          'title',
        ]
      );

      const conversation = pick(conversationSelector(story.conversationId), [
        'id',
        'title',
      ]);

      const { attachment, timestamp } = pick(story, [
        'attachment',
        'timestamp',
      ]);

      let storiesMap: Map<string, ConversationStoryType>;
      if (sender.hideStory) {
        storiesMap = hiddenStoriesById;
      } else {
        storiesMap = storiesById;
      }

      const storyView: StoryViewType = {
        attachment,
        isUnread: story.readStatus === ReadStatus.Unread,
        messageId: story.messageId,
        selectedReaction: story.selectedReaction,
        sender,
        timestamp,
      };

      const conversationStory = storiesMap.get(conversation.id) || {
        conversationId: conversation.id,
        group: conversation.id !== sender.id ? conversation : undefined,
        isHidden: Boolean(sender.hideStory),
        stories: [],
      };
      storiesMap.set(conversation.id, {
        ...conversationStory,
        stories: [...conversationStory.stories, storyView],
      });
    });

    return {
      hiddenStories: Array.from(hiddenStoriesById.values()).sort(
        sortByRecencyAndUnread
      ),
      stories: Array.from(storiesById.values()).sort(sortByRecencyAndUnread),
    };
  }
);