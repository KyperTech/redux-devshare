import {
  LOGIN_REQUEST, LOGIN_SUCCESS, LOGIN_FAILURE,
  SIGNUP_REQUEST, SIGNUP_SUCCESS, SIGNUP_FAILURE,
  LOGOUT_REQUEST, LOGOUT_SUCCESS, LOGOUT_FAILURE,
  RECOVER_REQUEST, RECOVER_SUCCESS, RECOVER_FAILURE,
  PROVIDER_REQUEST, PROVIDER_SUCCESS, PROVIDER_FAILURE
} from '../actions/account'

import { merge } from 'lodash'

export function account (state = {
  isFetching: false,
  error: null
}, action) {
  // console.log('account reducer:', action)
  switch (action.type) {
    case LOGIN_REQUEST:
      return merge(
        {},
        state,
        {isFetching: true, error: null}
      )
    case LOGIN_SUCCESS:
      return merge(
        {},
        state,
        {isFetching: false, error: null},
        action.response.user
      )
    case LOGIN_FAILURE:
      return merge(
        {},
        state, {isFetching: false, error: action.error}
      )
    case SIGNUP_REQUEST:
      return merge(
        {},
        state,
        {isFetching: true, error: null}
      )
    case SIGNUP_SUCCESS:
      return merge(
        {},
        state,
        {isFetching: false, error: null},
        action.response.user
      )
    case SIGNUP_FAILURE:
      return merge(
        {},
        state,
        { isFetching: false, error: action.error }
      )
    case PROVIDER_REQUEST:
      return merge(
        {},
        state,
        {isFetching: true, error: null}
      )
    case PROVIDER_SUCCESS:
      return merge(
        {},
        state,
        { isFetching: false, error: null },
        action.response.user
      )
    case PROVIDER_FAILURE:
      return merge(
        {},
        state,
        { isFetching: false, error: action.error || action.response.message || action.response }
      )
    case LOGOUT_REQUEST:
      return merge(
        {},
        state,
        {isFetching: true, error: null}
      )
    case LOGOUT_SUCCESS:
      return merge(
        {},
        { isFetching: false, error: null }
      )
    case LOGOUT_FAILURE:
      return merge(
        {},
        state,
        {isFetching: false, error: action.error}
      )
    case RECOVER_REQUEST:
      return merge(
        {},
        state,
        {isFetching: true, error: null}
      )
    case RECOVER_SUCCESS:
      return merge(
        {},
        {isFetching: false, error: null}
      )
    case RECOVER_FAILURE:
      return merge(
        {},
        state,
        {isFetching: false, error: action.error}
      )
    default:
      return state
  }
}
