import React, {Component} from 'react';
import {ActivityStat} from '../components/activity';
import MomentJS from 'moment'
import Moment from 'react-moment';
import _ from 'lodash';
import LoadingSpinner from '../components/loader'
import ActivityChart from '../components/chart'
import MapboxMap from '../components/mapbox'
import {getCookie} from '../components/cookieHelper'
import fire,{getUserStatus} from '../components/firebase'
import {IconBookmarkSolid,IconCheckLine} from '../components/icons/icons'

let activityDistance;
let activityTotalElevationGain;
let activityTotalCalories;
let activityMovingTime;
let activityMovingTimeHour;
let activityMovingTimeMinutes;
let activityMovingTimeSeconds;
let activityMovingTimeHHMMSS;

let activityAverageSpeed;
let activityMaxSpeed;
let activityAverageCadence;
let activityAverageHeartRate;
let activityMaxHeartRate;
let publicAccessToken = '011c89ee01402ab591de0240d59ee84455fd4d42'

class ActivityDetail extends Component {
  constructor(props) {
    super(props);
    getUserStatus().then( uid => {
      this.setState({
        userUid: uid
      })
    })
    this.state = {
      data: [],
      gear: [],
      athlete: {},
      map: {},
      chartData: {},
      loading: true,
      isFavourite: false,
    }
  }

  componentDidMount() {
    let userAccessToken = getCookie('access_token') || publicAccessToken
    let thisActivityApiUrl = 'https://www.strava.com/api/v3/activities/' + this.props.match.params.id;

    let thisActivityStreamApiUrl = thisActivityApiUrl + '/streams/altitude,heartrate,latlng,cadence,velocity_smooth?resolution=medium'

    this.setState({loading: true})

    fetch(thisActivityApiUrl, {
      method: 'get',
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer " + userAccessToken
      }
    }).then(function(response) {
      return response.json();
    }).then(json => {
      this.setState({
        data: json,
        gear: json.gear,
        athlete: json.athlete,
        map: json.map
      })

    }).catch(error => {console.log(error);})

    if(userAccessToken){
      fetch(thisActivityStreamApiUrl, {
        method: 'get',
        headers: {
          "content-type": "application/json",
          "authorization": "Bearer " + userAccessToken
        }
      }).then(function(response) {
        return response.json();
      }).then(json => {
        function findDistance(array){
          return array.type === 'distance'
        }
        function findHeartrate(array){
          return array.type === 'heartrate'
        }
        function findAltitude(array){
          return array.type === 'altitude'
        }
        function findLatlng(array){
          return array.type === 'latlng'
        }
        function findCadence(array){
          return array.type === 'cadence'
        }
        function findVelocity(array){
          return array.type === 'velocity_smooth'
        }

        if(json.find(findDistance)){
          this.setState(
            {
              distanceStream: json.find(findDistance).data
            }
          )
        }

        if(json.find(findAltitude)){
          this.setState(
            {
              altitudeStream: json.find(findAltitude).data
            }
          )
        }

        if(json.find(findHeartrate)){
          this.setState(
            {
              heartrateStream: json.find(findHeartrate).data
            }
          )
        }

        if(json.find(findLatlng)){
          this.setState(
            {
              latLngStream: json.find(findLatlng).data
            }
          )
        }

        if(json.find(findCadence)){
          this.setState(
            {
              cadenceStream: json.find(findCadence).data
            }
          )
        }

        if(json.find(findVelocity)){

          function toKPH(m) {
            let toKM = m / 1000
            let toKPH = toKM * 60 * 60

            return _.round(toKPH, 2);
          }

          let velocityStreamArray = json.find(findVelocity).data
          let velocityKPH = _.map(velocityStreamArray, toKPH)

          this.setState(
            {
              velocityStream: velocityKPH
            }
          )
        }

        this.setState({loading: false})
      }).catch(function(error){
        console.log('error fetching stream');
      })
    } else {
      // do nothing
    }

    this.checkFavouriteStatus()

  }

  checkFavouriteStatus = () => {
    this.setState({ loading: true })

    let favouritesRef = fire.database().ref('users/' + this.props.userUid + '/favourites');
    let activityId = this.props.match.params.id
    // console.log('this url param id is ' + activityId);
    favouritesRef.once('value', snapshot => {
      snapshot.forEach(child => {
        let favouriteActivityId = child.child('activityId').val()

        // console.log(favouriteActivityId);

        if(favouriteActivityId === activityId){
          console.log('matched');
          this.setState({
            isFavourite: true,
          })
        }
      })
      this.setState({ loading: false })
    })
  }

  unfavouriteThis = () => {


    let favouritesRef = fire.database().ref('users/' + this.state.userUid + '/favourites');
    let activityId = this.props.match.params.id

    if(this.state.isFavourite) {
      favouritesRef.once('value', snapshot => {
        snapshot.forEach(child => {
          let favouriteActivityId = child.child('activityId').val()

          if(favouriteActivityId === activityId) {
            console.log('remove from firebase');
            child.ref.remove()
          }
        })
      })

      this.setState({
        isFavourite: false
      })
    }

  }

  favouriteThis = () => {

    let favouritesRef = fire.database().ref('users/' + this.state.userUid + '/favourites');
    let activityId = this.props.match.params.id
    let newFavouriteRef = favouritesRef.push()

    if(!this.state.isFavourite) {
      console.log('save to firebase');
      newFavouriteRef.set({
        activityId: activityId,
        activityData: this.state.data
      })

      this.setState({
        isFavourite: true
      })
    }

  }

  render() {

    // Distance
    activityDistance = _.round(this.state.data.distance / 1000, 1)
    // Climb
    activityTotalElevationGain = _.round(this.state.data.total_elevation_gain, 0)
    // Calories
    activityTotalCalories = this.state.data.calories

    // Duration
    activityMovingTime = MomentJS.duration(this.state.data.moving_time, 'seconds')
    activityMovingTimeHour = activityMovingTime._data.hours
    activityMovingTimeMinutes = activityMovingTime._data.minutes
    activityMovingTimeSeconds = activityMovingTime._data.seconds
    activityMovingTimeHHMMSS = activityMovingTimeHour + ':' + activityMovingTimeMinutes + ':' + activityMovingTimeSeconds

    // Average Speed
    activityAverageSpeed = _.round((this.state.data.average_speed * 60 * 60) / 1000, 1)
    activityMaxSpeed = _.round((this.state.data.max_speed * 60 * 60) / 1000, 1)

    // Cadence
    activityAverageCadence = _.round(this.state.data.average_cadence, 1)

    // Heart Rate
    activityAverageHeartRate = this.state.data.average_heartrate
    activityMaxHeartRate = this.state.data.max_heartrate

    if (this.state.loading) {
      return (
        <div className="o-flex o-flex-align--center o-flex-justify--center">
          <LoadingSpinner/>
        </div>
      )
    } else {
      return (
        <div className="o-activity-detail">
          <div className="c-page-header">
            <h3 className="o-activity-detail-name">{this.state.data.name}</h3>
            <span className='o-activity-detail-time'>
              <Moment format="MMM DD, YYYY">{this.state.data.start_date}</Moment>
               <span> • </span>
              <Moment format="hh:mm a">{this.state.data.start_date}</Moment>
              <span> • </span>
              <a target="_blank" className="c-link" href={"https://strava.com/activities/" + this.state.data.id}>View on Strava</a>
            </span>
            <div className="t-top-spacing--l">
              {this.state.isFavourite
                ?
                <button className="c-btn c-btn--favourite is-favourite" onClick={this.unfavouriteThis}><IconCheckLine className="c-icon"/> <span>Favourited</span></button>
                :
                <button className="c-btn c-btn--favourite" onClick={this.favouriteThis}><IconBookmarkSolid className="c-icon"/> <span>Favourite</span></button>
               }
            </div>
          </div>
          <div className="o-activity-detail__summary">
            <div className="c-activity-summary o-flex o-flex-justify--start">
              {activityDistance ?
                <ActivityStat type="large" label="distance" value={activityDistance} unit="km"/>
                 : null}
              {activityTotalElevationGain ?
                <ActivityStat type="large" label="climb" value={activityTotalElevationGain} unit="m"/>
                 : null}
              {activityMovingTimeHHMMSS ?
                <ActivityStat type="large" label="duration" value={activityMovingTimeHHMMSS}/>
                 : null}
              {activityTotalCalories ?
                <ActivityStat type="large" label="calories" value={activityTotalCalories}/>
                 : null}
            </div>
            {this.state.map.summary_polyline &&
              <MapboxMap mapPolyline={this.state.map.polyline || this.state.map.summary_polyline} startLatlng={this.state.data.start_latlng} endLatlng={this.state.data.end_latlng}/>
            }
          </div>

          <div>
            {/* Speed Summary Card */}
            {
              activityAverageSpeed ?
                <div className="c-activity-graph c-activity-graph--velocity t-top-spacing--l">
                  <div className="c-activity-graph-container">
                    { this.state.velocityStream && this.state.altitudeStream ?
                      <h3 className="t-bottom-spacing--xl">Speed
                        <span className="c-activity-graph__header--supplementary "> & Elevation</span>
                      </h3>
                      :
                      <h3 className="t-bottom-spacing--xl">Speed</h3>
                    }
                    <div className="t-bottom-spacing--xl o-flex o-flex-justify--start">
                      <ActivityStat type="large" label="average" value={activityAverageSpeed} unit="km"/>
                      <ActivityStat type="large" label="max" value={activityMaxSpeed} unit="km"/>
                    </div>
                    {this.state.velocityStream
                      ?
                      <ActivityChart
                        altitudeStream={this.state.altitudeStream}
                        distanceStream={this.state.distanceStream}
                        mainDataStream={this.state.velocityStream}
                        dataType="velocity"
                        dataTypeLegendLabel="Speed"
                        dataTypeUnit="KM/H"
                      />
                      : null
                    }
                  </div>
                </div>
              : null
            }
            {/* Heart Rate Summary Card */}
            {
              activityAverageHeartRate ?
                <div className="c-activity-graph c-activity-graph--heartrate t-top-spacing--l">
                  <div className="c-activity-graph-container">
                    { this.state.heartrateStream && this.state.altitudeStream ?
                      <h3 className="t-bottom-spacing--xl">Heart Rate
                        <span className="c-activity-graph__header--supplementary "> & Elevation</span>
                      </h3>
                      :
                      <h3 className="t-bottom-spacing--xl">Heart Rate</h3>
                    }
                    <div className="t-bottom-spacing--xl o-flex o-flex-justify--start">
                      <ActivityStat type="large" label="average" value={activityAverageHeartRate} unit="bpm"/>
                      <ActivityStat type="large" label="max" value={activityMaxHeartRate} unit="bpm"/>
                    </div>
                    { this.state.heartrateStream ?
                    <ActivityChart
                      altitudeStream={this.state.altitudeStream}
                      distanceStream={this.state.distanceStream}
                      mainDataStream={this.state.heartrateStream}
                      dataType="heartrate"
                      dataTypeLegendLabel="Heart Rate"
                      dataTypeUnit="BPM"
                    />
                      : null
                    }
                  </div>
                </div>
              : null
            }
            {/* Cadence Summary Card */}
            {
              activityAverageCadence ?
                <div className="c-activity-graph c-activity-graph--cadence t-top-spacing--l">
                  <div className="c-activity-graph-container">
                    { this.state.cadenceStream && this.state.altitudeStream ?
                      <h3 className="t-bottom-spacing--xl">Cadence
                        <span className="c-activity-graph__header--supplementary "> & Elevation</span>
                      </h3>
                      :
                      <h3 className="t-bottom-spacing--xl">Cadence</h3>
                    }
                    <div className="t-bottom-spacing--xl o-flex o-flex-justify--start">
                      <ActivityStat type="large" label="average" value={activityAverageCadence} unit="rpm"/>
                    </div>
                    { this.state.cadenceStream ?
                    <ActivityChart
                      altitudeStream={this.state.altitudeStream}
                      distanceStream={this.state.distanceStream}
                      mainDataStream={this.state.cadenceStream}
                      dataType="cadence"
                      dataTypeLegendLabel="Cadence"
                      dataTypeUnit="RPM"
                    />
                      : null
                    }
                  </div>
                </div>
              : null
            }

          </div>
        </div>
      )
    }
  }
}

export default ActivityDetail
