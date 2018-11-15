// Copyright (C) 2018 The Android Open Source Project
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

package com.google.gerrit.server.config;

import com.google.common.collect.Multimap;
import com.google.gerrit.extensions.annotations.ExtensionPoint;
import com.google.gerrit.server.config.ConfigUpdatedEvent.ConfigUpdateEntry;
import com.google.gerrit.server.config.ConfigUpdatedEvent.UpdateResult;
import java.util.EventListener;

/**
 * Implementations of the GerritConfigListener interface expects to react GerritServerConfig
 * updates. @see ConfigUpdatedEvent.
 */
@ExtensionPoint
public interface GerritConfigListener extends EventListener {
  Multimap<UpdateResult, ConfigUpdateEntry> configUpdated(ConfigUpdatedEvent event);
}
