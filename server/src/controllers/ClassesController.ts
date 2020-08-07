import db from "../database/connection"
import convertHourToMinutes from "../utils/convertHourToMinutes"
import {Request, Response} from 'express'
interface ScheduleItem{
    week_day:number,
    from:string,
    to:string,
}
export default class ClassesControler{
    async index(req:Request,res:Response){
        const filters=req.query;
        try{
            const time=filters.time as string
            const subject=filters.subject as string
            const week_day=filters.week_day as string
           
            if(!subject||!week_day||!time)throw new Error("Missing filters to search for classes!");
            
            const timeInMinutes=convertHourToMinutes(time)
       
            const classes= await db('classes')
                .whereExists(function(){
                    this.select('class_schedule.*')
                    .from('class_schedule')
                    .whereRaw('`class_schedule`.`class_id`=`classes`.`id`')
                    .whereRaw('`class_schedule`.`week_day`= ?? ',[Number(week_day)])
                    .whereRaw('`class_schedule`.`from`<= ?? ',[Number(timeInMinutes)])
                    .whereRaw('`class_schedule`.`to` > ?? ',[Number(timeInMinutes)])
                })
                .where('classes.subject', '=', subject)
                .join('users','classes.user_id','=','users.id')
                .select(['classes.*', 'users.*'])
            return res.json(classes)
        }catch(error){
            console.log(error)
            res.status(404).send(error)
        }
        
    }

    async create(req:Request,res:Response){
        const {name, avatar, whatsapp, bio, cost, subject,schedule}= req.body
        const trx=await db.transaction()
        try{
        const insertedUserId=await trx('users').insert({
            name,
            avatar,
            whatsapp,
            bio,
        })
        const user_id=insertedUserId[0]
        if(!user_id)throw("Id do Professor não encontrado")
        
        const insertedClassId=await trx('classes').insert({
            subject,
            cost,
            user_id
        })
        const class_id=insertedClassId[0]
        const classSchedule= schedule.map((scheduleItem:ScheduleItem)=>{
            return{
                class_id,
                week_day: scheduleItem.week_day,
                from:convertHourToMinutes(scheduleItem.from),
                to:convertHourToMinutes(scheduleItem.to)
            }
        })
    
        await trx('class_schedule').insert(classSchedule)
        await trx.commit()
        return res.status(201).send()
        }catch(error){
            await trx.rollback()
            res.status(404).send(`Erro:${error}`)
        }
    }
}