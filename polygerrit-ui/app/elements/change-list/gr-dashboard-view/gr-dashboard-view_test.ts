/**
 * @license
 * Copyright (C) 2017 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import '../../../test/common-test-setup-karma';
import './gr-dashboard-view';
import {GrDashboardView} from './gr-dashboard-view';
import {GerritView} from '../../../services/router/router-model';
import {changeIsOpen} from '../../../utils/change-util';
import {ChangeStatus} from '../../../constants/constants';
import {
  createAccountDetailWithId,
  createChange,
} from '../../../test/test-data-generators';
import {
  addListenerForTest,
  stubReporting,
  stubRestApi,
  isHidden,
  mockPromise,
  queryAndAssert,
  query,
} from '../../../test/test-utils';
import {
  ChangeInfoId,
  DashboardId,
  RepoName,
  Timestamp,
} from '../../../types/common';
import * as MockInteractions from '@polymer/iron-test-helpers/mock-interactions';
import {GrOverlay} from '../../shared/gr-overlay/gr-overlay';
import {GrDialog} from '../../shared/gr-dialog/gr-dialog';
import {GrCreateChangeHelp} from '../gr-create-change-help/gr-create-change-help';
import {PageErrorEvent} from '../../../types/events';

const basicFixture = fixtureFromElement('gr-dashboard-view');

suite('gr-dashboard-view tests', () => {
  let element: GrDashboardView;

  let paramsChangedPromise: Promise<any>;
  let getChangesStub: sinon.SinonStub;

  setup(() => {
    stubRestApi('getLoggedIn').returns(Promise.resolve(false));
    stubRestApi('getAccountDetails').returns(
      Promise.resolve({
        registered_on: '2015-03-12 18:32:08.000000000' as Timestamp,
      })
    );
    stubRestApi('getAccountStatus').returns(Promise.resolve(undefined));
    getChangesStub = stubRestApi('getChanges').callsFake((_, qs) =>
      Promise.resolve((qs as string[]).map(() => []))
    );

    element = basicFixture.instantiate();
    let resolver: (value?: any) => void;
    paramsChangedPromise = new Promise(resolve => {
      resolver = resolve;
    });
    const paramsChanged = element._paramsChanged.bind(element);
    sinon
      .stub(element, '_paramsChanged')
      .callsFake(params => paramsChanged(params).then(() => resolver()));
  });

  suite('drafts banner functionality', () => {
    suite('_maybeShowDraftsBanner', () => {
      test('not dashboard/self', () => {
        element._maybeShowDraftsBanner({
          view: GerritView.DASHBOARD,
          user: 'notself',
          dashboard: '' as DashboardId,
        });
        assert.isFalse(element._showDraftsBanner);
      });

      test('no drafts at all', () => {
        element._results = [];
        element._maybeShowDraftsBanner({
          view: GerritView.DASHBOARD,
          user: 'self',
          dashboard: '' as DashboardId,
        });
        assert.isFalse(element._showDraftsBanner);
      });

      test('no drafts on open changes', () => {
        const openChange = {...createChange(), status: ChangeStatus.NEW};
        element._results = [
          {countLabel: '', name: '', query: 'has:draft', results: [openChange]},
        ];
        element._maybeShowDraftsBanner({
          view: GerritView.DASHBOARD,
          user: 'self',
          dashboard: '' as DashboardId,
        });
        assert.isFalse(element._showDraftsBanner);
      });

      test('no drafts on not open changes', () => {
        const notOpenChange = {...createChange(), status: '_' as ChangeStatus};
        element._results = [
          {
            name: '',
            countLabel: '',
            query: 'has:draft',
            results: [notOpenChange],
          },
        ];
        assert.isFalse(changeIsOpen(element._results![0].results[0]));
        element._maybeShowDraftsBanner({
          view: GerritView.DASHBOARD,
          user: 'self',
          dashboard: '' as DashboardId,
        });
        assert.isTrue(element._showDraftsBanner);
      });
    });

    test('_showDraftsBanner', () => {
      element._showDraftsBanner = false;
      flush();
      assert.isTrue(isHidden(queryAndAssert(element, '.banner')));

      element._showDraftsBanner = true;
      flush();
      assert.isFalse(isHidden(queryAndAssert(element, '.banner')));
    });

    test('delete tap opens dialog', () => {
      const handleOpenDeleteDialogStub = sinon.stub(
        element,
        '_handleOpenDeleteDialog'
      );
      element._showDraftsBanner = true;
      flush();

      MockInteractions.tap(queryAndAssert(element, '.banner .delete'));
      assert.isTrue(handleOpenDeleteDialogStub.called);
    });

    test('delete comments flow', async () => {
      sinon.spy(element, '_handleConfirmDelete');
      const reloadStub = sinon.stub(element, '_reload');

      // Set up control over timing of when RPC resolves.
      let deleteDraftCommentsPromiseResolver: (
        value: Response | PromiseLike<Response>
      ) => void;
      const deleteDraftCommentsPromise: Promise<Response> = new Promise(
        resolve => {
          deleteDraftCommentsPromiseResolver = resolve;
          return Promise.resolve(new Response());
        }
      );

      const deleteStub = stubRestApi('deleteDraftComments').returns(
        deleteDraftCommentsPromise
      );

      // Open confirmation dialog and tap confirm button.
      await queryAndAssert<GrOverlay>(element, '#confirmDeleteOverlay').open();
      MockInteractions.tap(
        queryAndAssert<GrDialog>(element, '#confirmDeleteDialog').confirmButton!
      );
      flush();
      assert.isTrue(deleteStub.calledWithExactly('-is:open'));
      assert.isTrue(
        queryAndAssert<GrDialog>(element, '#confirmDeleteDialog').disabled
      );
      assert.equal(reloadStub.callCount, 0);

      // Verify state after RPC resolves.
      // We have to put this in setTimeout otherwise typescript fails with
      // variable is used before assigned.
      setTimeout(() => deleteDraftCommentsPromiseResolver(new Response()), 0);
      await deleteDraftCommentsPromise;
      assert.equal(reloadStub.callCount, 1);
    });
  });

  test('_computeTitle', () => {
    assert.equal(element._computeTitle('self'), 'My Reviews');
    assert.equal(element._computeTitle('not self'), 'Dashboard for not self');
  });

  suite('_computeSectionCountLabel', () => {
    test('empty changes dont count label', () => {
      assert.equal('', element._computeSectionCountLabel([]));
    });

    test('1 change', () => {
      assert.equal('(1)', element._computeSectionCountLabel([createChange()]));
    });

    test('2 changes', () => {
      assert.equal(
        '(2)',
        element._computeSectionCountLabel([createChange(), createChange()])
      );
    });

    test('1 change and more', () => {
      assert.equal(
        '(1 and more)',
        element._computeSectionCountLabel([
          {...createChange(), _more_changes: true},
        ])
      );
    });
  });

  suite('_isViewActive', () => {
    test('nothing happens when user param is falsy', async () => {
      element.params = undefined;
      await flush();
      assert.equal(getChangesStub.callCount, 0);
    });

    test('content is refreshed when user param is updated', async () => {
      element.params = {
        view: GerritView.DASHBOARD,
        user: 'self',
        dashboard: '' as DashboardId,
      };
      await paramsChangedPromise;
      assert.equal(getChangesStub.callCount, 1);
    });
  });

  suite('selfOnly sections', () => {
    test('viewing self dashboard includes selfOnly sections', async () => {
      element.params = {
        view: GerritView.DASHBOARD,
        user: 'self',
        dashboard: '' as DashboardId,
        sections: [
          {name: '', query: '1'},
          {name: '', query: '2', selfOnly: true},
        ],
      };
      await paramsChangedPromise;
      assert.isTrue(getChangesStub.calledWith(undefined, ['1', '2']));
    });

    test('viewing dashboard when logged in includes owner:self query', async () => {
      element.account = createAccountDetailWithId(1);
      element.params = {
        view: GerritView.DASHBOARD,
        user: 'self',
        dashboard: '' as DashboardId,
        sections: [
          {name: '', query: '1'},
          {name: '', query: '2', selfOnly: true},
        ],
      };
      await paramsChangedPromise;
      assert.isTrue(
        getChangesStub.calledWith(undefined, ['1', '2', 'owner:self limit:1'])
      );
    });

    test("viewing another user's dashboard omits selfOnly sections", async () => {
      element.params = {
        view: GerritView.DASHBOARD,
        user: 'user',
        dashboard: '' as DashboardId,
        sections: [
          {name: '', query: '1'},
          {name: '', query: '2', selfOnly: true},
        ],
      };
      await paramsChangedPromise;
      assert.isTrue(getChangesStub.calledWith(undefined, ['1']));
    });
  });

  test('suffixForDashboard is included in getChanges query', async () => {
    element.params = {
      view: GerritView.DASHBOARD,
      dashboard: '' as DashboardId,
      sections: [
        {name: '', query: '1'},
        {name: '', query: '2', suffixForDashboard: 'suffix'},
      ],
    };
    await paramsChangedPromise;
    assert.isTrue(getChangesStub.calledOnce);
    assert.deepEqual(getChangesStub.firstCall.args, [
      undefined,
      ['1', '2 suffix'],
    ]);
  });

  suite('_getProjectDashboard', () => {
    test('dashboard with foreach', () => {
      stubRestApi('getDashboard').callsFake(() =>
        Promise.resolve({
          id: '' as DashboardId,
          project: 'project' as RepoName,
          defining_project: '' as RepoName,
          ref: '',
          path: '',
          url: '',
          title: 'title',
          foreach: 'foreach for ${project}',
          sections: [
            {name: 'section 1', query: 'query 1'},
            {name: 'section 2', query: '${project} query 2'},
          ],
        })
      );
      element
        ._getProjectDashboard('project' as RepoName, '' as DashboardId)
        .then(dashboard => {
          assert.deepEqual(dashboard, {
            title: 'title',
            sections: [
              {name: 'section 1', query: 'query 1 foreach for project'},
              {
                name: 'section 2',
                query: 'project query 2 foreach for project',
              },
            ],
          });
        });
    });

    test('dashboard without foreach', () => {
      stubRestApi('getDashboard').callsFake(() =>
        Promise.resolve({
          id: '' as DashboardId,
          project: 'project' as RepoName,
          defining_project: '' as RepoName,
          ref: '',
          path: '',
          url: '',
          title: 'title',
          sections: [
            {name: 'section 1', query: 'query 1'},
            {name: 'section 2', query: '${project} query 2'},
          ],
        })
      );
      element
        ._getProjectDashboard('project' as RepoName, '' as DashboardId)
        .then(dashboard => {
          assert.deepEqual(dashboard, {
            title: 'title',
            sections: [
              {name: 'section 1', query: 'query 1'},
              {name: 'section 2', query: 'project query 2'},
            ],
          });
        });
    });
  });

  test('hideIfEmpty sections', () => {
    const sections = [
      {name: 'test1', query: 'test1', hideIfEmpty: true},
      {name: 'test2', query: 'test2', hideIfEmpty: true},
    ];
    getChangesStub.restore();
    stubRestApi('getChanges').returns(Promise.resolve([[createChange()]]));

    element._fetchDashboardChanges({sections}, false).then(() => {
      assert.equal(element._results!.length, 1);
      assert.equal(element._results![0].name, 'test1');
    });
  });

  test('sets slot name to section name if custom state is requested', () => {
    const sections = [
      {name: 'Outgoing reviews', query: 'test1'},
      {name: 'test2', query: 'test2'},
    ];
    getChangesStub.restore();
    stubRestApi('getChanges').returns(Promise.resolve([[], []]));

    element._fetchDashboardChanges({sections}, false).then(() => {
      assert.equal(element._results!.length, 2);
      assert.equal(element._results![0].emptyStateSlotName, 'outgoing-slot');
      assert.isNotOk(element._results![1].emptyStateSlotName);
    });
  });

  test('toggling star will update change everywhere', () => {
    // It is important that the same change is represented by multiple objects
    // and all are updated.
    const change = {...createChange(), id: '5' as ChangeInfoId, starred: false};
    const sameChange = {
      ...createChange(),
      id: '5' as ChangeInfoId,
      starred: false,
    };
    const differentChange = {
      ...createChange(),
      id: '4' as ChangeInfoId,
      starred: false,
    };
    element._results = [
      {name: '', countLabel: '', query: 'has:draft', results: [change]},
      {
        name: '',
        countLabel: '',
        query: 'is:open',
        results: [sameChange, differentChange],
      },
    ];

    element._handleToggleStar(
      new CustomEvent('toggle-star', {
        detail: {
          change,
          starred: true,
        },
      })
    );

    assert.isTrue(change.starred);
    assert.isTrue(sameChange.starred);
    assert.isFalse(differentChange.starred);
  });

  test('_showNewUserHelp', () => {
    element._loading = false;
    element._showNewUserHelp = false;
    flush();

    assert.equal(
      queryAndAssert<HTMLDivElement>(
        element,
        '#emptyOutgoing'
      ).textContent!.trim(),
      'No changes'
    );
    query<GrCreateChangeHelp>(element, 'gr-create-change-help');
    assert.isNotOk(query<GrCreateChangeHelp>(element, 'gr-create-change-help'));
    element._showNewUserHelp = true;
    flush();

    assert.notEqual(
      queryAndAssert<HTMLDivElement>(
        element,
        '#emptyOutgoing'
      ).textContent!.trim(),
      'No changes'
    );
    assert.isOk(query<GrCreateChangeHelp>(element, 'gr-create-change-help'));
  });

  test('_computeUserHeaderClass', () => {
    assert.equal(element._computeUserHeaderClass(undefined), 'hide');
    assert.equal(
      element._computeUserHeaderClass({
        view: GerritView.DASHBOARD,
        dashboard: '' as DashboardId,
        user: 'self',
      }),
      'hide'
    );
    assert.equal(
      element._computeUserHeaderClass({
        view: GerritView.DASHBOARD,
        dashboard: '' as DashboardId,
        user: 'user',
      }),
      ''
    );
    assert.equal(
      element._computeUserHeaderClass({
        view: GerritView.DASHBOARD,
        dashboard: '' as DashboardId,
        project: 'p' as RepoName,
        user: 'user',
      }),
      'hide'
    );
    assert.equal(
      element._computeUserHeaderClass({
        view: GerritView.DASHBOARD,
        dashboard: '' as DashboardId,
        project: 'p' as RepoName,
        user: 'user',
      }),
      'hide'
    );
  });

  test('404 page', async () => {
    const response = {...new Response(), status: 404};
    stubRestApi('getDashboard').callsFake(
      async (_project, _dashboard, errFn) => {
        if (errFn !== undefined) {
          errFn(response);
        }
        return Promise.resolve(undefined);
      }
    );
    const promise = mockPromise();
    addListenerForTest(document, 'page-error', e => {
      assert.strictEqual((e as PageErrorEvent).detail.response, response);
      promise.resolve();
    });
    element.params = {
      view: GerritView.DASHBOARD,
      dashboard: 'dashboard' as DashboardId,
      project: 'project' as RepoName,
      user: '',
    };
    await Promise.all([paramsChangedPromise, promise]);
  });

  test('params change triggers dashboardDisplayed()', async () => {
    stubRestApi('getDashboard').returns(
      Promise.resolve({
        id: '' as DashboardId,
        project: 'project' as RepoName,
        defining_project: '' as RepoName,
        ref: '',
        path: '',
        url: '',
        title: 'title',
        foreach: 'foreach for ${project}',
        sections: [],
      })
    );
    const dashboardDisplayedStub = stubReporting('dashboardDisplayed');
    element.params = {
      view: GerritView.DASHBOARD,
      dashboard: 'dashboard' as DashboardId,
      project: 'project' as RepoName,
      user: '',
    };
    await paramsChangedPromise;
    assert.isTrue(dashboardDisplayedStub.calledOnce);
  });

  test('selectedChangeIndex is derived from the params', async () => {
    stubRestApi('getDashboard').returns(
      Promise.resolve({
        id: '' as DashboardId,
        project: 'project' as RepoName,
        defining_project: '' as RepoName,
        ref: '',
        path: '',
        url: '',
        title: 'title',
        foreach: 'foreach for ${project}',
        sections: [],
      })
    );
    element.viewState = {
      101001: 23,
    };
    element.params = {
      view: GerritView.DASHBOARD,
      dashboard: 'dashboard' as DashboardId,
      project: 'project' as RepoName,
      user: '101001',
    };
    flush();
    stubReporting('dashboardDisplayed');
    await paramsChangedPromise;
    assert.equal(element._selectedChangeIndex, 23);
  });
});
