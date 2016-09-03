// export * as account from './account'
// export * as projects from './projects'
// export * as files from './files'

import {
    SET,
    SET_PROFILE,
    LOGIN,
    LOGOUT,
    LOGIN_ERROR,
    // UNAUTHORIZED_ERROR,
    NO_VALUE,
    AUTHENTICATION_INIT_STARTED,
    AUTHENTICATION_INIT_FINISHED
} from '../constants'

import { Promise } from 'es6-promise'

const getWatchPath = (event, path) => event + ':' + ((path.substring(0, 1) === '/') ? '' : '/') + path

/**
 * @description Set a new watcher
 * @param {Object} firebase - Internal firebase object
 * @param {String} event - Type of event to watch for
 * @param {String} path - Path to watch with watcher
 * @param {String} queryId - Id of query
 */
const setWatcher = (devshare, event, path, queryId = undefined) => {
  const id = (queryId) ? event + ':/' + queryId : getWatchPath(event, path)

  if (devshare._.watchers[id]) {
    devshare._.watchers[id]++
  } else {
    devshare._.watchers[id] = 1
  }

  return devshare._.watchers[id]
}

/**
 * @description Get count of currently attached watchers
 * @param {Object} firebase - Internal firebase object
 * @param {String} event - Type of event to watch for
 * @param {String} path - Path to watch with watcher
 * @param {String} queryId - Id of query
 */
const getWatcherCount = (devshare, event, path, queryId = undefined) => {
  const id = (queryId) ? event + ':/' + queryId : getWatchPath(event, path)
  return devshare._.watchers[id]
}

/**
 * @description Get query id from query path
 * @param {String} path - Path from which to get query id
 */
const getQueryIdFromPath = (path) => {
  const origPath = path
  let pathSplitted = path.split('#')
  path = pathSplitted[0]

  let isQuery = pathSplitted.length > 1
  let queryParams = isQuery ? pathSplitted[1].split('&') : []
  let queryId = isQuery ? queryParams.map((param) => {
    let splittedParam = param.split('=')
    if (splittedParam[0] === 'queryId') {
      return splittedParam[1]
    }
  }).filter(q => q) : undefined

  return (queryId && queryId.length > 0)
    ? queryId[0]
    : ((isQuery) ? origPath : undefined)
}

/**
 * @description Remove/Unset a watcher
 * @param {Object} firebase - Internal firebase object
 * @param {String} event - Type of event to watch for
 * @param {String} path - Path to watch with watcher
 * @param {String} queryId - Id of query
 */
const unsetWatcher = (devshare, event, path, queryId = undefined) => {
  let id = queryId || getQueryIdFromPath(path)
  path = path.split('#')[0]

  if (!id) {
    id = getWatchPath(event, path)
  }

  if (devshare._.watchers[id] <= 1) {
    delete devshare._.watchers[id]
    if (event !== 'first_child') {
      devshare.firebase.database().ref().child(path).off(event)
    }
  } else if (devshare._.watchers[id]) {
    devshare._.watchers[id]--
  }
}

/**
 * @description Watch a specific event type
 * @param {Object} firebase - Internal firebase object
 * @param {Function} dispatch - Action dispatch function
 * @param {String} event - Type of event to watch for
 * @param {String} path - Path to watch with watcher
 * @param {String} dest
 * @param {Boolean} onlyLastEvent - Whether or not to listen to only the last event
 */
export const watchEvent = (devshare, dispatch, event, path, dest, onlyLastEvent = false) => {
  let isQuery = false
  let queryParams = []
  let queryId = getQueryIdFromPath(path)

  if (queryId) {
    let pathSplitted = path.split('#')
    path = pathSplitted[0]
    isQuery = true
    queryParams = pathSplitted[1].split('&')
  }

  const watchPath = (!dest) ? path : path + '@' + dest
  const counter = getWatcherCount(devshare, event, watchPath, queryId)

  if (counter > 0) {
    if (onlyLastEvent) {
      // listen only to last query on same path
      if (queryId) {
        unsetWatcher(devshare, event, path, queryId)
      } else {
        return
      }
    }
  }

  setWatcher(devshare, event, watchPath, queryId)

  if (event === 'first_child') {
    // return
    return devshare.firebase.database()
      .ref()
      .child(path)
      .orderByKey()
      .limitToFirst(1)
      .once('value', snapshot => {
        if (snapshot.val() === null) {
          dispatch({
            type: NO_VALUE,
            path
          })
        }
      })
  }

  let query = devshare.firebase.database().ref().child(path)

  if (isQuery) {
    let doNotParse = false

    queryParams.forEach((param) => {
      param = param.split('=')
      switch (param[0]) {
        case 'orderByValue':
          query = query.orderByValue()
          doNotParse = true
          break
        case 'orderByPriority':
          query = query.orderByPriority()
          doNotParse = true
          break
        case 'orderByKey':
          query = query.orderByKey()
          doNotParse = true
          break
        case 'orderByChild':
          query = query.orderByChild(param[1])
          break
        case 'limitToFirst':
          query = query.limitToFirst(parseInt(param[1]))
          break
        case 'limitToLast':
          query = query.limitToLast(parseInt(param[1]))
          break
        case 'equalTo':
          let equalToParam = !doNotParse ? parseInt(param[1]) || param[1] : param[1]
          equalToParam = equalToParam === 'null' ? null : equalToParam
          query = param.length === 3
            ? query.equalTo(equalToParam, param[2])
            : query.equalTo(equalToParam)
          break
        case 'startAt':
          let startAtParam = !doNotParse ? parseInt(param[1]) || param[1] : param[1]
          startAtParam = startAtParam === 'null' ? null : startAtParam
          query = param.length === 3
            ? query.startAt(startAtParam, param[2])
            : query.startAt(startAtParam)
          break
        case 'endAt':
          let endAtParam = !doNotParse ? parseInt(param[1]) || param[1] : param[1]
          endAtParam = endAtParam === 'null' ? null : endAtParam
          query = param.length === 3
            ? query.endAt(endAtParam, param[2])
            : query.endAt(endAtParam)
          break
        default:
          break
      } })
  }

  const runQuery = (q, e, p) => {
    q.on(e, snapshot => {
      let data = (e === 'child_removed') ? undefined : snapshot.val()
      const resultPath = dest || (e === 'value') ? p : p + '/' + snapshot.key
      if (dest && e !== 'child_removed') {
        data = {
          _id: snapshot.key,
          val: snapshot.val()
        }
      }
      dispatch({
        type: SET,
        path: resultPath,
        data,
        snapshot
      })
    })
  }

  runQuery(query, event, path)
}

/**
 * @description Remove watcher from an event
 * @param {Object} firebase - Internal firebase object
 * @param {String} event - Event for which to remove the watcher
 * @param {String} path - Path of watcher to remove
 */
export const unWatchEvent = (devshare, event, path, queryId = undefined) =>
    unsetWatcher(devshare, event, path, queryId)

/**
 * @description Add watchers to a list of events
 * @param {Object} firebase - Internal firebase object
 * @param {Function} dispatch - Action dispatch function
 * @param {Array} events - List of events for which to add watchers
 */
export const watchEvents = (devshare, dispatch, events) =>
    events.forEach(event => watchEvent(devshare, dispatch, event.name, event.path))

/**
 * @description Remove watchers from a list of events
 * @param {Object} firebase - Internal firebase object
 * @param {Array} events - List of events for which to remove watchers
 */
export const unWatchEvents = (devshare, events) =>
    events.forEach(event => unWatchEvent(devshare, event.name, event.path))

/**
 * @description Dispatch login error action
 * @param {Function} dispatch - Action dispatch function
 * @param {Object} authError - Error object
 */
const dispatchLoginError = (dispatch, authError) =>
    dispatch({
      type: LOGIN_ERROR,
      authError
    })

/**
 * @description Dispatch login error action
 * @param {Function} dispatch - Action dispatch function
 * @param {Object} authError - Error object
 */
// const dispatchUnauthorizedError = (dispatch, authError) =>
//     dispatch({
//       type: UNAUTHORIZED_ERROR,
//       authError
//     })

/**
 * @description Dispatch login action
 * @param {Function} dispatch - Action dispatch function
 * @param {Object} auth - Auth data object
 */
const dispatchLogin = (dispatch, auth) =>
  dispatch({
    type: LOGIN,
    auth,
    authError: null
  })

/**
 * @description Remove listener from user profile
 * @param {Object} firebase - Internal firebase object
 */
const unWatchUserProfile = (devshare) => {
  const authUid = devshare._.authUid
  const userProfile = devshare._.config.userProfile
  if (devshare._.profileWatch) {
    devshare.firebase.database().ref().child(`${userProfile}/${authUid}`).off('value', devshare._.profileWatch)
    devshare._.profileWatch = null
  }
}

/**
 * @description Watch user profile
 * @param {Function} dispatch - Action dispatch function
 * @param {Object} firebase - Internal firebase object
 */
const watchUserProfile = (dispatch, devshare) => {
  const authUid = devshare._.authUid
  const userProfile = devshare._.config.userProfile
  unWatchUserProfile(devshare)
  if (devshare._.config.userProfile) {
    devshare._.profileWatch = devshare.firebase.database()
      .ref()
      .child(`${userProfile}/${authUid}`)
      .on('value', snap => {
        dispatch({
          type: SET_PROFILE,
          profile: snap.val()
        })
      })
  }
}

/**
 * @description Initialize authentication state change listener that
 * watches user profile and dispatches login action
 * @param {Function} dispatch - Action dispatch function
 */
export const init = (dispatch, devshare) => {
  dispatch({ type: AUTHENTICATION_INIT_STARTED })

  devshare.firebase.auth().onAuthStateChanged(authData => {
    if (!authData) {
      return dispatch({ type: LOGOUT })
    }

    devshare._.authUid = authData.uid
    watchUserProfile(dispatch, devshare)

    dispatchLogin(dispatch, authData)
  })
  dispatch({ type: AUTHENTICATION_INIT_FINISHED })

  devshare.firebase.auth().currentUser
}

/**
 * @description Login with errors dispatched
 * @param {Function} dispatch - Action dispatch function
 * @param {Object} firebase - Internal firebase object
 * @param {Object} credentials - Login credentials
 * @param {Object} credentials.email - Email to login with (only needed for email login)
 * @param {Object} credentials.password - Password to login with (only needed for email login)
 * @param {Object} credentials.provider - Provider name such as google, twitter (only needed for 3rd party provider login)
 * @param {Object} credentials.type - Popup or redirect (only needed for 3rd party provider login)
 * @param {Object} credentials.token - Custom or provider token
 */
export const login = (dispatch, devshare, credentials) => {
  dispatchLoginError(dispatch, null)
  return devshare.login(credentials)
    .catch(err => {
      dispatchLoginError(dispatch, err)
      return Promise.reject(err)
    })
}

/**
 * @description Logout of firebase and dispatch logout event
 * @param {Function} dispatch - Action dispatch function
 * @param {Object} firebase - Internal firebase object
 * @return {Promise}
 */
export const logout = (dispatch, devshare) =>
  devshare.logout()
    .then(() => {
      dispatch({ type: LOGOUT })
      devshare._.authUid = null
      unWatchUserProfile(devshare)
    })

/**
 * @description Create a new user in auth and add an account to userProfile root
 * @param {Function} dispatch - Action dispatch function
 * @param {Object} firebase - Internal firebase object
 * @param {Object} credentials - Login credentials
 * @return {Promise}
 */
export const signup = (dispatch, devshare, credentials) => {
  dispatchLoginError(dispatch, null)
  return devshare.signup(credentials)
    .catch(err => {
      if (err) {
        switch (err.code) {
          case 'auth/user-not-found':
            dispatchLoginError(dispatch, new Error('The specified user account does not exist.'))
            break
          default:
            dispatchLoginError(dispatch, err)
        }
      }
      return Promise.reject(err)
    })
}

/**
 * @description Send password reset email to provided email
 * @param {Function} dispatch - Action dispatch function
 * @param {Object} firebase - Internal firebase object
 * @param {String} email - Email to send recovery email to
 * @return {Promise}
 */
export const resetPassword = (dispatch, devshare, email) => {
  dispatchLoginError(dispatch, null)
  return devshare.firebase.auth()
    .sendPasswordResetEmail(email)
    .catch((err) => {
      if (err) {
        switch (err.code) {
          case 'INVALID_USER':
            dispatchLoginError(dispatch, new Error('The specified user account does not exist.'))
            break
          default:
            dispatchLoginError(dispatch, err)
        }
        return Promise.reject(err)
      }
    })
}

export default { watchEvents, unWatchEvents, init, login, signup, logout, resetPassword }
