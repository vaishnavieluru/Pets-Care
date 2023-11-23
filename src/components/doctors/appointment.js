import React, { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import {
  Typography,
  Table,
  TableContainer,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Button,
} from '@material-ui/core';
import { collection, query, orderBy, doc, getDocs,addDoc,  getDoc, deleteDoc, serverTimestamp, setDoc, startAfter } from 'firebase/firestore';
import { db, storage } from '../../services/firebase';
import { useAuth } from "../../context/authContext";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const useStyles = makeStyles({

  container: {
    maxHeight: 'calc(100vh - 80px)',
    overflowY: 'auto',
  },
  scrollbar: {
    scrollbarWidth: 'thin',
    scrollbarColor: 'transparent transparent', /* Set the desired color */
    '&::-webkit-scrollbar': {
      width: '8px', /* Adjust the width as needed */
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: 'transparent',
    },
    '&::-webkit-scrollbar-track': {
      backgroundColor: 'transparent',
    },
  },
});

const Appointments = () => {
  const classes = useStyles();
  const { currentUser } = useAuth();
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {

    fetchAppointments();
  }, []);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() -1);
  const yesterdayISOString = yesterday.toISOString().split('T')[0];
  const fetchAppointments = async () => {
    setAppointments([])
    try {
      const AppointmentRef = collection(db, `doctor/${currentUser.uid}/Appointment`);
      const q = query(AppointmentRef, orderBy("date","asc"), startAfter(yesterdayISOString));
      const querySnapshot = await getDocs(q);
      
      const AppointmentData = await Promise.all(querySnapshot.docs.map((doc) => ({
        ...doc.data()
      })));
      const newDocs = await Promise.all(AppointmentData.map(async (item) => {
        console.log(item);
        let dayAppointmentsObj = []
        for (let key in item) {
          if (item.hasOwnProperty(key) && key.includes('_')) {
            let strSplit = key.split('_');
            let userId = strSplit[0];
            console.log(userId);
            const docRef = doc(db, 'customer', userId);
            const documentSnapshot = await getDoc(docRef);
            console.log(documentSnapshot.data())
            const value = item[key];
            dayAppointmentsObj.push({date: item.date,userId: documentSnapshot.data().uid,  userName : documentSnapshot.data().name, phoneNumber: documentSnapshot.data().phoneNumber,
               start: value[0], end : value[1], status: value[2], fee: value[3], appointmentId: value[4]})
          }
        }
          return dayAppointmentsObj;
       }))
       setAppointments((prevDocs) => [...prevDocs, ...newDocs]);
    } catch (error) {
      console.error('Error fetching Appointment ', error);
    }
  }

  const handleCancelAppointment = async (appointmentId, selectedDate, start, userId) => {
    const DoctorRef = doc(db, `doctor/${currentUser.uid}/Appointment`, selectedDate);
    const documentSnapshot = await getDoc(DoctorRef);
    let arrayData = documentSnapshot.data()[`${userId}_${start}`];
    let fee =  (arrayData[1] - arrayData[0]) * 200;
    try {
      const updated = {
        [`${userId}_${start}`] : [arrayData[0], arrayData[1], "unavaliable", fee, appointmentId],
        dayFee :  documentSnapshot.data().dayFee - fee
      };
      
      await setDoc(DoctorRef, updated, {merge : true});
    } catch (error) {
      console.error('Error updating appointment:', error);
    }


    const Doctor = doc(db, `doctor`, currentUser.uid);
    const DoctorSnapshot = await getDoc(Doctor);
    let totalFee =  DoctorSnapshot.data().totalFee;
    let activeAppointments =  DoctorSnapshot.data().activeAppointments;
    try {
      const updated = {
        activeAppointments: activeAppointments - 1,
        totalFee : totalFee - fee
      };
      
      await setDoc(Doctor, updated, {merge : true});
    } catch (error) {
      console.error('Error updating doctor:', error);
    }

    const refundRef = doc(db, `refund`, appointmentId);
    try {
      const updated = {
        uid : appointmentId,
        customer: userId,
        doctor: currentUser.uid,
        refundAmount: fee
      };
      
      await setDoc(refundRef, updated, {merge : true});
    } catch (error) {
      console.error('Error updating refund:', error);
    }

    const currentUserDetails = doc(db, `customer/${userId}/Appointment`, appointmentId);
    try {
      const updated = {
        status: "doctor unavaliable",
      };
      
      await setDoc(currentUserDetails, updated, {merge : true});
    } catch (error) {
      console.error('Error updating appointment:', error);
    }
    fetchAppointments();
  };

  return (
    <div className={`${classes.container} ${classes.scrollbar}`}>
      <Typography variant="h4" component="h1" align="center">
        Appointments 
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Booked By</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Slot</TableCell>
              <TableCell>Paid</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {appointments.map((dayAppointments) => (<>
             { dayAppointments.map((appointment, index) => (
                <TableRow key={appointment.appointmentId}>
                <TableCell>{appointment.date}</TableCell>
                <TableCell>{appointment.userName}</TableCell>
                <TableCell>{appointment.phoneNumber}</TableCell>
                <TableCell>{`${Math.floor(appointment.start)}:${String(appointment.start % 1 * 60).padStart(2, '0')} ${
                  appointment.start < 9 || appointment.start === 12 ? 'pm' : 'am'
                              } - ${Math.floor(appointment.end)}:${String(appointment.end % 1 * 60).padStart(2, '0')} ${
                                appointment.end < 9 || appointment.end === 12 ? 'pm' : 'am'
                              }`}</TableCell>
                <TableCell>{appointment.fee}</TableCell>
                <TableCell>{appointment.status}</TableCell>
                <TableCell>
                  <Button
                    variant="outlined"
                    color="secondary"
                    disabled={!(appointment.status === "active")}
                    onClick={() => handleCancelAppointment(appointment.appointmentId, appointment.date, appointment.start, appointment.userId)}
                  >
                    Unavalible
                  </Button>
                </TableCell>
              </TableRow>
              ))}
              </>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};

export default Appointments;
