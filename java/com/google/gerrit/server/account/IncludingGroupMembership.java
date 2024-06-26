// Copyright (C) 2012 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package com.google.gerrit.server.account;

import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Sets;
import com.google.gerrit.entities.AccountGroup;
import com.google.gerrit.entities.InternalGroup;
import com.google.gerrit.server.CurrentUser;
import com.google.inject.Inject;
import com.google.inject.assistedinject.Assisted;
import java.util.Collection;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Determines membership in the internal group system for a given user.
 *
 * <p>Groups the user is directly a member of are pulled from the in-memory AccountCache by way of
 * the IdentifiedUser. Transitive group memberhips are resolved on demand starting from the
 * requested group and looking for a path to a group the user is a member of. Other group backends
 * are supported by recursively invoking the universal GroupMembership.
 */
public class IncludingGroupMembership implements GroupMembership {
  public interface Factory {
    IncludingGroupMembership create(CurrentUser user);
  }

  private final GroupCache groupCache;
  private final GroupIncludeCache includeCache;
  private final CurrentUser user;
  private final Map<AccountGroup.UUID, Boolean> memberOf;
  private Set<AccountGroup.UUID> knownGroups;

  @Inject
  IncludingGroupMembership(
      GroupCache groupCache, GroupIncludeCache includeCache, @Assisted CurrentUser user) {
    this.groupCache = groupCache;
    this.includeCache = includeCache;
    this.user = user;
    memberOf = new ConcurrentHashMap<>();
  }

  @Override
  public boolean contains(AccountGroup.UUID id) {
    if (id == null) {
      return false;
    }

    Boolean b = memberOf.get(id);
    return b != null ? b : containsAnyOf(ImmutableSet.of(id));
  }

  @Override
  public boolean containsAnyOf(Iterable<AccountGroup.UUID> queryIds) {
    // Prefer lookup of a cached result over expanding includes.
    boolean tryExpanding = false;
    for (AccountGroup.UUID id : queryIds) {
      Boolean b = memberOf.get(id);
      if (b == null) {
        tryExpanding = true;
      } else if (b) {
        return true;
      }
    }

    if (tryExpanding) {
      Set<AccountGroup.UUID> queryIdsSet = new HashSet<>();
      queryIds.forEach(i -> queryIdsSet.add(i));
      Map<AccountGroup.UUID, InternalGroup> groups = groupCache.get(queryIdsSet);
      for (AccountGroup.UUID id : queryIds) {
        if (memberOf.containsKey(id)) {
          // Membership was earlier proven to be false.
          continue;
        }

        memberOf.put(id, false);
        InternalGroup group = groups.get(id);
        if (group == null) {
          continue;
        }
        if (user.isIdentifiedUser() && group.getMembers().contains(user.getAccountId())) {
          memberOf.put(id, true);
          return true;
        }
        if (search(group.getSubgroups())) {
          memberOf.put(id, true);
          return true;
        }
      }
    }

    return false;
  }

  @Override
  public Set<AccountGroup.UUID> intersection(Iterable<AccountGroup.UUID> groupIds) {
    Set<AccountGroup.UUID> r = new HashSet<>();
    for (AccountGroup.UUID id : groupIds) {
      if (contains(id)) {
        r.add(id);
      }
    }
    return r;
  }

  private boolean search(Iterable<AccountGroup.UUID> ids) {
    return user.getEffectiveGroups().containsAnyOf(ids);
  }

  private ImmutableSet<AccountGroup.UUID> computeKnownGroups() {
    GroupMembership membership = user.getEffectiveGroups();
    Collection<AccountGroup.UUID> direct =
        user.isIdentifiedUser()
            ? includeCache.getGroupsWithMember(user.getAccountId())
            : ImmutableList.of();
    direct.forEach(groupUuid -> memberOf.put(groupUuid, true));
    Set<AccountGroup.UUID> r = Sets.newHashSet(direct);
    r.remove(null);

    Set<AccountGroup.UUID> q = Sets.newHashSet(r);
    for (AccountGroup.UUID g : membership.intersection(includeCache.allExternalMembers())) {
      if (g != null && r.add(g)) {
        q.add(g);
      }
    }

    while (!q.isEmpty()) {
      Collection<AccountGroup.UUID> parents = includeCache.parentGroupsOf(q);
      q.clear();
      for (AccountGroup.UUID g : parents) {
        if (r.add(g)) {
          q.add(g);
          memberOf.put(g, true);
        }
      }
    }
    return ImmutableSet.copyOf(r);
  }

  @Override
  public Set<AccountGroup.UUID> getKnownGroups() {
    if (knownGroups == null) {
      knownGroups = computeKnownGroups();
    }
    return knownGroups;
  }
}
